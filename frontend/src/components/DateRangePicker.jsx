import { useState, useRef, useEffect } from 'react';
import { formatDate, addDays } from '../utils/dates';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inRange(day, start, end) {
  if (!start || !end) return false;
  const t = day.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function buildCalendar(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let week = new Array(startDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DateRangePicker({ checkIn, checkOut, minDate, maxDate, maxNights = 14, onChange }) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(null); // null | 'start' picked, waiting for end
  const [hoverDate, setHoverDate] = useState(null);
  const ref = useRef(null);

  // Calendar month to display
  const initDate = checkIn ? new Date(checkIn + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const minD = minDate ? new Date(minDate + 'T00:00:00') : null;
  const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null;
  const startDate = checkIn ? new Date(checkIn + 'T00:00:00') : null;
  const endDate = checkOut ? new Date(checkOut + 'T00:00:00') : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSelecting(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const handleDayClick = (day) => {
    if (!selecting) {
      // First click — set start
      setSelecting(day);
      setHoverDate(null);
    } else {
      // Second click — set end
      let s = selecting, e = day;
      if (e <= s) { s = day; e = selecting; }
      const nights = Math.round((e - s) / 86400000);
      if (nights > maxNights) {
        e = addDays(s, maxNights);
      }
      if (nights < 1) return;
      onChange(formatDate(s), formatDate(e));
      setSelecting(null);
      setHoverDate(null);
      setOpen(false);
    }
  };

  const isDisabled = (day) => {
    if (minD && day < minD) return true;
    if (maxD && day > maxD) return true;
    if (selecting) {
      const diff = Math.round((day - selecting) / 86400000);
      if (diff > maxNights || diff < -maxNights) return true;
    }
    return false;
  };

  // Display range for hover preview
  const previewStart = selecting || startDate;
  const previewEnd = selecting ? (hoverDate || selecting) : endDate;
  const rangeStart = previewStart && previewEnd && previewStart <= previewEnd ? previewStart : previewEnd;
  const rangeEnd = previewStart && previewEnd && previewStart <= previewEnd ? previewEnd : previewStart;

  const weeks1 = buildCalendar(viewYear, viewMonth);
  const m2 = viewMonth === 11 ? 0 : viewMonth + 1;
  const y2 = viewMonth === 11 ? viewYear + 1 : viewYear;
  const weeks2 = buildCalendar(y2, m2);

  // Format display
  const displayText = checkIn && checkOut
    ? `${checkIn} → ${checkOut}`
    : 'Select dates';

  return (
    <div className="drp-wrap" ref={ref}>
      <button type="button" className="drp-trigger" onClick={() => setOpen(!open)}>
        <span className="drp-text">{displayText}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 6h12" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </button>

      {open && (
        <div className="drp-dropdown">
          {selecting && <div className="drp-hint">Select check-out date</div>}
          <div className="drp-calendars">
            {[{ weeks: weeks1, year: viewYear, month: viewMonth }, { weeks: weeks2, year: y2, month: m2 }].map(({ weeks, year, month }, ci) => (
              <div key={ci} className="drp-cal">
                <div className="drp-cal-header">
                  {ci === 0 && <button type="button" className="drp-nav" onClick={prevMonth}>&lsaquo;</button>}
                  <span className="drp-month">{MONTHS[month]} {year}</span>
                  {ci === 1 && <button type="button" className="drp-nav" onClick={nextMonth}>&rsaquo;</button>}
                </div>
                <div className="drp-days-header">
                  {DAYS.map(d => <span key={d} className="drp-day-label">{d}</span>)}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="drp-week">
                    {week.map((day, di) => {
                      if (!day) return <span key={di} className="drp-cell empty" />;
                      const disabled = isDisabled(day);
                      const isStart = rangeStart && sameDay(day, rangeStart);
                      const isEnd = rangeEnd && sameDay(day, rangeEnd);
                      const isIn = inRange(day, rangeStart, rangeEnd);
                      const isToday = sameDay(day, new Date());
                      return (
                        <button
                          type="button"
                          key={di}
                          className={`drp-cell${isStart ? ' start' : ''}${isEnd ? ' end' : ''}${isIn ? ' in-range' : ''}${isToday ? ' today' : ''}${disabled ? ' disabled' : ''}`}
                          disabled={disabled}
                          onClick={() => handleDayClick(day)}
                          onMouseEnter={() => selecting && !disabled && setHoverDate(day)}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
