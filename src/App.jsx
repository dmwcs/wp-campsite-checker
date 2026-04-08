import { useState, useEffect, useCallback } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { VIC_HOLIDAYS_2026 } from './data/holidays';
import { fetchAvailability, parseAvailability } from './utils/api';
import { formatDate, formatDisplayDate, getWeekendDates, addDays, isHolidayPast } from './utils/dates';
import './App.css';

const BOOKING_URL = 'https://bookings.parks.vic.gov.au/book#';

const TABS = [
  { id: 'weekend', label: '周末', icon: '◐', help: '快速查询最近8周的周末营地空位。选择后自动查询，显示完整周末（2晚）和每晚的空位情况。' },
  { id: 'holiday', label: '节假日', icon: '⟡', help: '快速查询维州公共假期的营地空位。点选假期自动查询，显示整段假期和每晚的空位情况。' },
  { id: 'custom', label: '自定义', icon: '◈', help: '自己挑入住和离开日期，最长 14 晚。选好日期后点「开始查询」。' },
];

const WEEKEND_LABELS = ['这周末', '下周末', '下下周末', '往后第4周', '往后第5周', '往后第6周', '往后第7周', '往后第8周'];

function getWeekendOptions() {
  return WEEKEND_LABELS.map((label, i) => {
    const { friday, sunday } = getWeekendDates(i);
    const dateStr = `${friday.getMonth() + 1}/${friday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
    return { value: i, label: `${label}（${dateStr}）` };
  });
}

function calcNights(checkIn, checkOut) {
  const a = new Date(checkIn + 'T00:00:00');
  const b = new Date(checkOut + 'T00:00:00');
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function App() {
  const [prefs, updatePrefs] = usePreferences();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [helpTab, setHelpTab] = useState(null);

  const query = useCallback(async (tab, opts) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      let data;
      if (tab === 'weekend') {
        data = await queryWeekend(opts.weekendOffset);
      } else if (tab === 'holiday') {
        if (opts.holidayIndex < 0) {
          setLoading(false);
          return;
        }
        data = await queryHoliday(VIC_HOLIDAYS_2026[opts.holidayIndex]);
      } else {
        data = await queryCustom(opts.customDate, opts.customNights);
      }
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-query on mount
  useEffect(() => {
    if (prefs.tab === 'holiday' && prefs.holidayIndex < 0) return;
    query(prefs.tab, prefs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab) => {
    updatePrefs({ tab });
    setResults(null);
    setError(null);
    if (tab === 'weekend') {
      query(tab, { ...prefs, tab });
    } else if (tab === 'holiday' && prefs.holidayIndex >= 0) {
      query(tab, { ...prefs, tab });
    }
  };

  const handleWeekendChange = (offset) => {
    const next = { ...prefs, weekendOffset: offset };
    updatePrefs({ weekendOffset: offset });
    query('weekend', next);
  };

  const handleHolidaySelect = (index) => {
    const next = { ...prefs, holidayIndex: index };
    updatePrefs({ holidayIndex: index });
    query('holiday', next);
  };

  const handleCustomQuery = () => {
    const nights = calcNights(prefs.customDate, prefs.customCheckout);
    if (nights <= 0) return;
    updatePrefs({ customDate: prefs.customDate, customCheckout: prefs.customCheckout });
    query('custom', { ...prefs, customNights: nights });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-badge">Wilsons Promontory</div>
        <h1 className="header-title">营地空位查询</h1>
        <p className="header-subtitle">
          仅显示开车可达的营地 · 数据来自 Parks Victoria
        </p>
      </header>

      {/* Tab Bar */}
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <div key={tab.id} className="tab-item-wrap">
            <button
              className={`tab-item ${prefs.tab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
              <span
                className={`help-dot ${helpTab === tab.id ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setHelpTab(helpTab === tab.id ? null : tab.id); }}
              >?</span>
            </button>
            {helpTab === tab.id && (
              <div className="help-popover">
                <div className="help-popover-inner">
                  <p>{tab.help}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>
      {helpTab && <div className="help-backdrop" onClick={() => setHelpTab(null)} />}

      {/* Tab Content */}
      <div className="tab-content">
        {prefs.tab === 'weekend' && (
          <div className="selector-row">
            <label className="selector-label">选择周末</label>
            <div className="select-wrap">
              <select
                value={prefs.weekendOffset}
                onChange={(e) => handleWeekendChange(Number(e.target.value))}
              >
                {getWeekendOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {prefs.tab === 'holiday' && (
          <div className="holiday-section">
            <div className="holiday-label">维州公共假期 · 2026</div>
            <div className="holiday-grid">
              {VIC_HOLIDAYS_2026.map((h, i) => {
                const past = isHolidayPast(h);
                return (
                  <button
                    key={i}
                    className={`holiday-card ${prefs.holidayIndex === i ? 'active' : ''} ${past ? 'past' : ''}`}
                    onClick={() => handleHolidaySelect(i)}
                  >
                    <span className="holiday-name">{h.name}</span>
                    <span className="holiday-meta">{h.desc} · {h.nights}晚</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {prefs.tab === 'custom' && (() => {
          const nights = calcNights(prefs.customDate, prefs.customCheckout);
          return (
            <div className="custom-row">
              <div className="custom-field">
                <label>入住日期</label>
                <input
                  type="date"
                  value={prefs.customDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const updates = { customDate: newDate };
                    // 如果离开日期早于入住日期，自动调整为入住+1天
                    if (prefs.customCheckout <= newDate) {
                      updates.customCheckout = formatDate(addDays(new Date(newDate + 'T00:00:00'), 1));
                    }
                    updatePrefs(updates);
                  }}
                />
              </div>
              <div className="custom-field">
                <label>离开日期</label>
                <input
                  type="date"
                  value={prefs.customCheckout}
                  min={prefs.customDate ? formatDate(addDays(new Date(prefs.customDate + 'T00:00:00'), 1)) : undefined}
                  max={prefs.customDate ? formatDate(addDays(new Date(prefs.customDate + 'T00:00:00'), 14)) : undefined}
                  onChange={(e) => updatePrefs({ customCheckout: e.target.value })}
                />
              </div>
              {nights > 0 && (
                <div className={`nights-badge ${nights > 14 ? 'over' : ''}`}>{nights > 14 ? '超出14晚' : `${nights}晚`}</div>
              )}
              <button className="query-btn" onClick={handleCustomQuery} disabled={loading || nights <= 0 || nights > 14}>
                {loading ? '查询中...' : '开始查询'}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Results */}
      <div className="results">
        {loading && (
          <div className="loading">
            <div className="loading-dots">
              <span /><span /><span />
            </div>
            <span>正在查询营地空位...</span>
          </div>
        )}

        {error && (
          <div className="error-card">
            <span className="error-icon">!</span>
            <div>
              <strong>查询失败</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {results && !loading && <ResultsView results={results} />}
      </div>

      <footer className="footer">
        <span>Made by Shelton</span>
      </footer>
    </div>
  );
}

/* ── Query functions ── */

async function queryWeekend(offset) {
  const { friday, saturday, sunday } = getWeekendDates(offset);

  const [friToSat, satToSun, friToSun] = await Promise.all([
    fetchAvailability(formatDate(friday), 1),
    fetchAvailability(formatDate(saturday), 1),
    fetchAvailability(formatDate(friday), 2),
  ]);

  const options = [
    { title: `完整周末 ${formatDisplayDate(friday)} → ${formatDisplayDate(sunday)}`, nights: '2晚', items: parseAvailability(friToSun), highlight: true },
    { title: `${formatDisplayDate(friday)} → ${formatDisplayDate(saturday)}`, nights: '1晚', items: parseAvailability(friToSat) },
    { title: `${formatDisplayDate(saturday)} → ${formatDisplayDate(sunday)}`, nights: '1晚', items: parseAvailability(satToSun) },
  ];

  return { type: 'weekend', options };
}

async function queryHoliday(holiday) {
  const start = new Date(holiday.date + 'T00:00:00');
  const end = addDays(start, holiday.nights);

  // Full period + per-night
  const promises = [fetchAvailability(holiday.date, holiday.nights)];
  for (let i = 0; i < holiday.nights; i++) {
    promises.push(fetchAvailability(formatDate(addDays(start, i)), 1));
  }
  const [fullData, ...nightData] = await Promise.all(promises);

  const options = [
    {
      title: `完整假期 ${formatDisplayDate(start)} → ${formatDisplayDate(end)}`,
      nights: `${holiday.nights}晚`,
      items: parseAvailability(fullData),
      highlight: true,
    },
    ...nightData.map((data, i) => {
      const d = addDays(start, i);
      const next = addDays(start, i + 1);
      return {
        title: `${formatDisplayDate(d)} → ${formatDisplayDate(next)}`,
        nights: '1晚',
        items: parseAvailability(data),
      };
    }),
  ];

  return { type: 'holiday', holiday, options };
}

async function queryCustom(dateStr, nights) {
  const start = new Date(dateStr + 'T00:00:00');
  const end = addDays(start, nights);

  const promises = [fetchAvailability(dateStr, nights)];
  if (nights > 1) {
    for (let i = 0; i < nights; i++) {
      promises.push(fetchAvailability(formatDate(addDays(start, i)), 1));
    }
  }
  const [fullData, ...nightData] = await Promise.all(promises);

  const options = [
    {
      title: `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`,
      nights: `${nights}晚`,
      items: parseAvailability(fullData),
      highlight: true,
    },
    ...nightData.map((data, i) => {
      const d = addDays(start, i);
      const next = addDays(start, i + 1);
      return {
        title: `${formatDisplayDate(d)} → ${formatDisplayDate(next)}`,
        nights: '1晚',
        items: parseAvailability(data),
      };
    }),
  ];

  return { type: 'custom', options };
}

/* ── Results Components ── */

function ResultsView({ results }) {
  const { options, allAvailable } = results;

  return (
    <>
      {allAvailable && (
        <div className="all-available-banner">
          三种方案都有空位
        </div>
      )}

      {options.length > 1 && options[0].highlight && (
        <div className="breakdown-label">逐晚明细</div>
      )}

      <div className="options-list">
        {options.map((opt, i) => (
          <OptionCard key={i} option={opt} />
        ))}
      </div>
    </>
  );
}

function OptionCard({ option }) {
  const [expanded, setExpanded] = useState(false);
  const { title, nights, items, highlight } = option;
  const available = items.length > 0;

  // Group by operator
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.operator]) grouped[item.operator] = [];
    grouped[item.operator].push(item);
  }

  const totalSites = items.reduce((sum, i) => sum + (typeof i.numAvailable === 'number' ? i.numAvailable : 0), 0);

  return (
    <div className={`option-card ${available ? 'available' : 'unavailable'} ${highlight ? 'highlight' : ''}`}>
      <div
        className={`option-header ${available ? 'clickable' : ''}`}
        onClick={() => available && setExpanded(!expanded)}
      >
        <div className={`status-dot ${available ? 'green' : 'red'}`} />
        <div className="option-info">
          <span className="option-title">{title}</span>
          <span className="option-nights">{nights}</span>
        </div>
        <span className={`status-badge ${available ? 'green' : 'red'}`}>
          {available ? `${totalSites > 0 ? totalSites + '个空位' : '有空位'}` : '已满'}
        </span>
        {available && (
          <svg className={`expand-arrow ${expanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>

      {available && expanded && (
        <div className="operator-groups">
          {Object.entries(grouped).map(([operatorName, operatorItems]) => (
            <div key={operatorName} className="operator-group">
              <div className="operator-name">{operatorName || '未知营地'}</div>
              <div className="site-list">
                {operatorItems.map((item, j) => (
                  <a
                    key={j}
                    className="site-item"
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="site-name">{item.name}</span>
                    <span className="site-meta">
                      <span className="site-price">${item.cost}</span>
                      <span className="site-stock">
                        {item.numAvailable === '未知' ? '有房' : `剩 ${item.numAvailable}`}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
