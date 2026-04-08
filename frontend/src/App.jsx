import { useState, useEffect, useCallback } from 'react';
import { usePreferences } from './hooks/usePreferences';
import { useFavourites } from './hooks/useFavourites';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthModal';
import { VIC_HOLIDAYS_2026 } from './data/holidays';
import { fetchAvailability, parseAvailability } from './utils/api';
import { formatDate, formatDisplayDate, getWeekendDates, addDays, isHolidayPast } from './utils/dates';
import './App.css';

const BOOKING_URL = 'https://bookings.parks.vic.gov.au/book#';

const TABS = [
  { id: 'weekend', label: 'Weekend', icon: '◐', help: 'Quickly check campsite availability for the next 8 weekends. Auto-queries on selection, showing full weekend (2 nights) and per-night availability.' },
  { id: 'holiday', label: 'Holidays', icon: '⟡', help: 'Quickly check campsite availability for VIC public holidays. Auto-queries on selection, showing full holiday and per-night availability.' },
  { id: 'custom', label: 'Custom', icon: '◈', help: 'Pick your own check-in and check-out dates, up to 14 nights. Select dates then click "Search".' },
  { id: 'favourites', label: 'Favourites', icon: '☆', help: 'Save date ranges you care about. Opens the page and auto-checks availability for all your favourites.' },
];

const WEEKEND_LABELS = ['This weekend', 'Next weekend', 'In 2 weeks', 'In 3 weeks', 'In 4 weeks', 'In 5 weeks', 'In 6 weeks', 'In 7 weeks'];

function getWeekendOptions() {
  return WEEKEND_LABELS.map((label, i) => {
    const { friday, sunday } = getWeekendDates(i);
    const dateStr = `${friday.getMonth() + 1}/${friday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
    return { value: i, label: `${label} (${dateStr})` };
  });
}

function calcNights(checkIn, checkOut) {
  const a = new Date(checkIn + 'T00:00:00');
  const b = new Date(checkOut + 'T00:00:00');
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

// Date limits: today → ~8 months from today
const TODAY = formatDate(new Date());
const MAX_DATE = formatDate(addDays(new Date(), 240));

export default function App() {
  const [prefs, updatePrefs] = usePreferences();
  const { user, checking: authChecking, signOut, refresh: refreshAuth } = useAuth();
  const { favourites, addFavourite, removeFavourite, markBooked, unmarkBooked, loading: favsLoading } = useFavourites();
  const { settings, updateEmail } = useSettings();
  const [emailInput, setEmailInput] = useState('');
  const [emailEditing, setEmailEditing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tabResults, setTabResults] = useState({}); // { weekend: {...}, holiday: {...}, custom: {...} }
  const [tabErrors, setTabErrors] = useState({});
  const [helpTab, setHelpTab] = useState(null);
  const [showAddFav, setShowAddFav] = useState(false);
  const [favDate, setFavDate] = useState(formatDate(addDays(new Date(), 1)));
  const [favCheckout, setFavCheckout] = useState(formatDate(addDays(new Date(), 3)));
  const [favName, setFavName] = useState('');
  const [liveStatus, setLiveStatus] = useState({}); // { [date]: { status, items } }
  const [liveFullPeriod, setLiveFullPeriod] = useState({}); // { [favId]: { status, items, checking } }

  const query = useCallback(async (tab, opts) => {
    setLoading(true);
    setTabErrors((prev) => ({ ...prev, [tab]: null }));

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
      setTabResults((prev) => ({ ...prev, [tab]: data }));
    } catch (e) {
      setTabErrors((prev) => ({ ...prev, [tab]: e.message }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync email input when settings load
  useEffect(() => {
    if (settings.email) setEmailInput(settings.email);
  }, [settings.email]);

  // Live check all monitoring nights + full periods
  const checkFavouritesLive = useCallback(async (favList) => {
    const datesToCheck = new Set();
    for (const fav of favList) {
      for (const n of (fav.nights || [])) {
        if (n.status !== 'booked') datesToCheck.add(n.date);
      }
    }
    if (datesToCheck.size === 0) return;

    // Mark all as checking
    const init = {};
    for (const d of datesToCheck) init[d] = { status: 'checking', items: [] };
    setLiveStatus(init);

    // Mark full periods as checking
    const fpInit = {};
    for (const fav of favList) {
      const unbooked = (fav.nights || []).filter(n => n.status !== 'booked');
      if (unbooked.length > 1) fpInit[fav.id] = { status: 'checking', items: [] };
    }
    setLiveFullPeriod(fpInit);

    // Query per-night in parallel
    await Promise.all([...datesToCheck].map(async (date) => {
      try {
        const data = await fetchAvailability(date, 1);
        const avail = parseAvailability(data);
        setLiveStatus((prev) => ({
          ...prev,
          [date]: { status: avail.length > 0 ? 'available' : 'full', items: avail },
        }));
      } catch {
        setLiveStatus((prev) => ({ ...prev, [date]: { status: 'error', items: [] } }));
      }
    }));

    // Query full period for each favourite
    await Promise.all(favList.map(async (fav) => {
      const unbooked = (fav.nights || []).filter(n => n.status !== 'booked');
      if (unbooked.length <= 1) return;
      try {
        const nights = calcNights(fav.checkIn, fav.checkOut);
        const data = await fetchAvailability(fav.checkIn, nights);
        const avail = parseAvailability(data);
        setLiveFullPeriod((prev) => ({
          ...prev,
          [fav.id]: { status: avail.length > 0 ? 'available' : 'full', items: avail },
        }));
      } catch {
        setLiveFullPeriod((prev) => ({ ...prev, [fav.id]: { status: 'error', items: [] } }));
      }
    }));
  }, []);

  // Auto-check when favourites load
  useEffect(() => {
    if (prefs.tab === 'favourites' && user && favourites.length > 0 && !favsLoading) {
      checkFavouritesLive(favourites);
    }
  }, [prefs.tab, user, favourites, favsLoading, checkFavouritesLive]);

  // Auto-query on mount
  useEffect(() => {
    if (prefs.tab === 'favourites') return; // favourites load from API automatically
    if (prefs.tab === 'holiday' && prefs.holidayIndex < 0) return;
    query(prefs.tab, prefs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab) => {
    updatePrefs({ tab });
    // Weekend/holiday auto-query only if no cached results
    if (tab === 'weekend' && !tabResults.weekend) {
      query(tab, { ...prefs, tab });
    } else if (tab === 'holiday' && prefs.holidayIndex >= 0 && !tabResults.holiday) {
      query(tab, { ...prefs, tab });
    }
  };

  const handleAddFav = async () => {
    const nights = calcNights(favDate, favCheckout);
    if (nights <= 0) return;
    const newFav = { name: favName || `${favDate} → ${favCheckout}`, checkIn: favDate, checkOut: favCheckout };
    await addFavourite(newFav);
    setShowAddFav(false);
    setFavName('');
  };

  const handleRemoveFav = (id, name) => {
    if (!confirm(`Remove monitor "${name}"?`)) return;
    removeFavourite(id);
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
        <h1 className="header-title">Campsite Availability Checker</h1>
        <p className="header-subtitle">
          Showing drive-in campsites only · Data from Parks Victoria
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
            <label className="selector-label">Select weekend</label>
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
            <div className="holiday-label">VIC Public Holidays · 2026</div>
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
                    <span className="holiday-meta">{h.desc} · {h.nights} nights</span>
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
                <label>Check-in</label>
                <input
                  type="date"
                  value={prefs.customDate}
                  min={TODAY}
                  max={MAX_DATE}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const updates = { customDate: newDate };
                    if (prefs.customCheckout <= newDate) {
                      updates.customCheckout = formatDate(addDays(new Date(newDate + 'T00:00:00'), 1));
                    }
                    updatePrefs(updates);
                  }}
                />
              </div>
              <div className="custom-field">
                <label>Check-out</label>
                <input
                  type="date"
                  value={prefs.customCheckout}
                  min={prefs.customDate ? formatDate(addDays(new Date(prefs.customDate + 'T00:00:00'), 1)) : undefined}
                  max={prefs.customDate ? formatDate(addDays(new Date(prefs.customDate + 'T00:00:00'), 14)) < MAX_DATE ? formatDate(addDays(new Date(prefs.customDate + 'T00:00:00'), 14)) : MAX_DATE : MAX_DATE}
                  onChange={(e) => updatePrefs({ customCheckout: e.target.value })}
                />
              </div>
              {nights > 0 && (
                <div className={`nights-badge ${nights > 14 ? 'over' : ''}`}>{nights > 14 ? 'Exceeds 14 nights' : `${nights} nights`}</div>
              )}
              <button className="query-btn" onClick={handleCustomQuery} disabled={loading || nights <= 0 || nights > 14}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          );
        })()}

        {prefs.tab === 'favourites' && !user && !authChecking && (
          <div className="fav-gate">
            <div className="fav-gate-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M24 4l5.5 11.2L42 17.3l-9 8.8 2.1 12.4L24 32.8l-11.1 5.7L15 26.1l-9-8.8 12.5-2.1z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
                <path d="M24 14l3 6.1 6.8 1.1-4.9 4.8 1.2 6.8L24 29.5l-6.1 3.3 1.2-6.8-4.9-4.8L21 20.1z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.15"/>
              </svg>
            </div>
            <h3 className="fav-gate-title">Favourites & Notifications</h3>
            <p className="fav-gate-desc">
              Sign in to save date ranges you care about. The system checks availability every 30 minutes and emails you as soon as a spot opens up.
            </p>
            <button className="fav-gate-btn" onClick={() => setShowAuthModal(true)}>
              Sign In / Sign Up
            </button>
          </div>
        )}

        {prefs.tab === 'favourites' && user && (
          <div className="fav-section">
            <div className="fav-user-bar">
              <span className="fav-user-email">{user?.signInDetails?.loginId || user?.username}</span>
              <button className="sign-out-btn" onClick={signOut}>Sign Out</button>
            </div>

            {/* Email notification settings */}
            <div className="fav-email-row">
              <div className="custom-field" style={{flex: 1}}>
                <label>Notification Email</label>
                <input
                  type="email"
                  placeholder="Get notified when a spot opens up"
                  value={emailEditing ? emailInput : (settings.email || '')}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={!emailEditing}
                />
              </div>
              {!emailEditing ? (
                <button
                  className="fav-edit-btn"
                  style={{alignSelf: 'flex-end'}}
                  onClick={() => { setEmailInput(settings.email || ''); setEmailEditing(true); }}
                >
                  Edit
                </button>
              ) : (
                <button
                  className="query-btn"
                  style={{alignSelf: 'flex-end'}}
                  onClick={() => { updateEmail(emailInput); setEmailEditing(false); }}
                  disabled={!emailInput}
                >
                  Save
                </button>
              )}
            </div>

            {favsLoading && <div className="loading"><span>Loading favourites...</span></div>}

            {/* Add button / form */}
            {!showAddFav ? (
              <button className="fav-add-btn" onClick={() => setShowAddFav(true)} disabled={favourites.length >= 5}>
                <span className="fav-add-icon">+</span>
                {favourites.length >= 5 ? `Limit reached (${favourites.length}/5)` : `Add Monitor (${favourites.length}/5)`}
              </button>
            ) : (
              <div className="fav-form">
                <div className="fav-form-row">
                  <div className="custom-field">
                    <label>Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Melbourne Cup"
                      value={favName}
                      onChange={(e) => setFavName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="fav-form-row">
                  <div className="custom-field">
                    <label>Check-in</label>
                    <input
                      type="date"
                      value={favDate}
                      min={TODAY}
                      max={MAX_DATE}
                      onChange={(e) => {
                        setFavDate(e.target.value);
                        if (favCheckout <= e.target.value) {
                          setFavCheckout(formatDate(addDays(new Date(e.target.value + 'T00:00:00'), 1)));
                        }
                      }}
                    />
                  </div>
                  <div className="custom-field">
                    <label>Check-out</label>
                    <input
                      type="date"
                      value={favCheckout}
                      min={favDate ? formatDate(addDays(new Date(favDate + 'T00:00:00'), 1)) : undefined}
                      max={favDate ? formatDate(addDays(new Date(favDate + 'T00:00:00'), 14)) < MAX_DATE ? formatDate(addDays(new Date(favDate + 'T00:00:00'), 14)) : MAX_DATE : MAX_DATE}
                      onChange={(e) => setFavCheckout(e.target.value)}
                    />
                  </div>
                </div>
                <div className="fav-form-actions">
                  <button className="query-btn" onClick={handleAddFav} disabled={calcNights(favDate, favCheckout) <= 0}>
                    Add
                  </button>
                  <button className="fav-cancel-btn" onClick={() => { setShowAddFav(false); setFavName(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Favourite list */}
            {favourites.length === 0 && !showAddFav && (
              <div className="fav-empty">No favourites yet. Click "Add Monitor" above to get started.</div>
            )}

            <div className="fav-list">
              {favourites.map((fav) => {
                const startDate = new Date(fav.checkIn + 'T00:00:00');
                const endDate = new Date(fav.checkOut + 'T00:00:00');
                const totalNights = fav.nights?.length || 0;
                const bookedCount = fav.nights?.filter(n => n.status === 'booked').length || 0;
                const liveAvailCount = (fav.nights || []).filter(n => n.status !== 'booked' && liveStatus[n.date]?.status === 'available').length;

                return (
                  <div key={fav.id} className="mon-card">
                    {/* Card header */}
                    <div className="mon-head">
                      <div className="mon-head-left">
                        <h3 className="mon-title">{fav.name}</h3>
                        <span className="mon-range">{formatDisplayDate(startDate)} → {formatDisplayDate(endDate)} · {totalNights} nights</span>
                      </div>
                      <div className="mon-head-right">
                        {liveAvailCount > 0 && <span className="mon-pill green">{liveAvailCount} available</span>}
                        {bookedCount > 0 && <span className="mon-pill teal">{bookedCount} booked</span>}
                        <button className="mon-delete" onClick={() => handleRemoveFav(fav.id, fav.name)} aria-label="Remove">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mon-progress">
                      {(fav.nights || []).map((night) => {
                        const live = liveStatus[night.date];
                        const s = night.status === 'booked' ? 'booked' : live?.status === 'available' ? 'available' : 'full';
                        return <div key={night.date} className={`mon-prog-seg ${s}`} />;
                      })}
                    </div>

                    {/* Full period status */}
                    {liveFullPeriod[fav.id] && totalNights > 1 && (() => {
                      const fp = liveFullPeriod[fav.id];
                      const fpItems = fp.items || [];
                      const fpOption = fp.status === 'available' ? {
                        title: `Full period ${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}`,
                        nights: `${totalNights} nights`,
                        items: fpItems,
                      } : null;
                      return (
                        <div className="mon-full-period">
                          {fp.status === 'checking' && (
                            <div className="mn-row"><div className="mn-row-head"><span className="mn-tag muted">Checking full period...</span></div></div>
                          )}
                          {fp.status === 'available' && fpOption && (
                            <OptionCard option={fpOption} />
                          )}
                          {fp.status === 'full' && (
                            <div className="mn-row"><div className="mn-row-head">
                              <div className="mn-dot full" />
                              <span className="mn-date full">Full period {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}</span>
                              <div className="mn-row-right"><span className="mn-tag muted">{totalNights} nights · Full</span></div>
                            </div></div>
                          )}
                        </div>
                      );
                    })()}

                    {totalNights > 1 && <div className="mon-breakdown-label">Nightly breakdown</div>}

                    {/* Night rows */}
                    <div className="mon-nights">
                      {(fav.nights || []).map((night) => {
                        const d = new Date(night.date + 'T00:00:00');
                        const nd = new Date(night.nextDate + 'T00:00:00');
                        const live = liveStatus[night.date];
                        const effectiveStatus = night.status === 'booked' ? 'booked'
                          : live?.status === 'available' ? 'available'
                          : live?.status === 'full' ? 'full'
                          : night.status === 'monitoring' ? 'full' : night.status;
                        const isChecking = live?.status === 'checking' && night.status !== 'booked';
                        const siteItems = live?.items || [];
                        const totalSpots = siteItems.reduce((s, i) => s + (typeof i.numAvailable === 'number' ? i.numAvailable : 0), 0);

                        return <FavNightRow
                          key={night.date}
                          date={d}
                          nextDate={nd}
                          status={effectiveStatus}
                          isChecking={isChecking}
                          totalSpots={totalSpots}
                          siteItems={siteItems}
                          onMarkBooked={() => markBooked(fav.id, night.date)}
                          onUnmark={() => unmarkBooked(fav.id, night.date)}
                        />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={refreshAuth} />}
      </div>

      {/* Results (non-favourites) */}
      {prefs.tab !== 'favourites' && (
      <div className="results">
        {loading && (
          <div className="loading">
            <div className="loading-dots">
              <span /><span /><span />
            </div>
            <span>Checking campsite availability...</span>
          </div>
        )}

        {tabErrors[prefs.tab] && (
          <div className="error-card">
            <span className="error-icon">!</span>
            <div>
              <strong>Query failed</strong>
              <p>{tabErrors[prefs.tab]}</p>
            </div>
          </div>
        )}

        {tabResults[prefs.tab] && !loading && <ResultsView results={tabResults[prefs.tab]} />}
      </div>
      )}

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
    { title: `Full Weekend ${formatDisplayDate(friday)} → ${formatDisplayDate(sunday)}`, nights: '2 nights', items: parseAvailability(friToSun), highlight: true },
    { title: `${formatDisplayDate(friday)} → ${formatDisplayDate(saturday)}`, nights: '1 night', items: parseAvailability(friToSat) },
    { title: `${formatDisplayDate(saturday)} → ${formatDisplayDate(sunday)}`, nights: '1 night', items: parseAvailability(satToSun) },
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
      title: `Full Holiday ${formatDisplayDate(start)} → ${formatDisplayDate(end)}`,
      nights: `${holiday.nights} nights`,
      items: parseAvailability(fullData),
      highlight: true,
    },
    ...nightData.map((data, i) => {
      const d = addDays(start, i);
      const next = addDays(start, i + 1);
      return {
        title: `${formatDisplayDate(d)} → ${formatDisplayDate(next)}`,
        nights: '1 night',
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
      nights: `${nights} nights`,
      items: parseAvailability(fullData),
      highlight: true,
    },
    ...nightData.map((data, i) => {
      const d = addDays(start, i);
      const next = addDays(start, i + 1);
      return {
        title: `${formatDisplayDate(d)} → ${formatDisplayDate(next)}`,
        nights: '1 night',
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
          All options have availability
        </div>
      )}

      {options.length > 1 && options[0].highlight && (
        <div className="breakdown-label">Nightly Breakdown</div>
      )}

      <div className="options-list">
        {options.map((opt, i) => (
          <OptionCard key={i} option={opt} />
        ))}
      </div>
    </>
  );
}

function FavNightRow({ date, nextDate, status, isChecking, totalSpots, siteItems, onMarkBooked, onUnmark }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = status === 'available' && siteItems.length > 0;

  // Group sites by operator
  const grouped = {};
  for (const item of siteItems) {
    if (!grouped[item.operator]) grouped[item.operator] = [];
    grouped[item.operator].push(item);
  }

  return (
    <div className={`mn-row ${status} ${expanded ? 'expanded' : ''}`}>
      <div
        className={`mn-row-head ${hasDetails ? 'clickable' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <div className={`mn-dot ${status}`} />
        <span className={`mn-date ${status}`}>
          {formatDisplayDate(date)} → {formatDisplayDate(nextDate)}
        </span>
        <div className="mn-row-right">
          {isChecking && <span className="mn-tag muted">Checking...</span>}

          {!isChecking && status === 'full' && (
            <>
              <span className="mn-tag muted">Full</span>
              <button className="mn-action" onClick={(e) => { e.stopPropagation(); onMarkBooked(); }}>Mark booked</button>
            </>
          )}

          {!isChecking && status === 'available' && (
            <>
              <span className="mn-tag green">{totalSpots} spots</span>
              <a className="mn-book" href={BOOKING_URL} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Book</a>
              <svg className={`mn-chevron ${expanded ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </>
          )}

          {!isChecking && status === 'booked' && (
            <>
              <span className="mn-tag teal">Booked</span>
              <button className="mn-action" onClick={(e) => { e.stopPropagation(); onUnmark(); }}>Undo</button>
            </>
          )}
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="mn-details">
          {Object.entries(grouped).map(([operatorName, items]) => (
            <div key={operatorName} className="mn-operator">
              <span className="mn-op-name">{operatorName}</span>
              <div className="mn-sites">
                {items.map((item, j) => (
                  <a key={j} className="mn-site" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    <span className="mn-site-name">{item.name}</span>
                    <span className="mn-site-right">
                      <span className="mn-site-price">${item.cost}</span>
                      <span className="mn-site-stock">{typeof item.numAvailable === 'number' ? item.numAvailable : '?'} left</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
          <div className="mn-details-footer">
            <button className="mn-action" onClick={onMarkBooked}>Mark booked</button>
          </div>
        </div>
      )}
    </div>
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
          {available ? `${totalSites > 0 ? totalSites + ' Available' : 'Available'}` : 'Full'}
        </span>
        {available && (
          <svg className={`expand-arrow ${expanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>

      {available && expanded && (
        <div className="operator-groups">
          {Object.entries(grouped).map(([operatorName, operatorItems]) => (
            <div key={operatorName} className="operator-group">
              <div className="operator-name">{operatorName || 'Unknown campground'}</div>
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
                        {item.numAvailable === 'unknown' ? 'Available' : `${item.numAvailable} left`}
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
