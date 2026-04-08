import { useState, useCallback } from 'react';
import { getTomorrow, formatDate, addDays } from '../utils/dates';

const STORAGE_KEY = 'wp-prefs';

function getDefaultCheckout() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(addDays(tomorrow, 1));
}

const defaultPrefs = {
  tab: 'weekend',
  weekendOffset: 0,
  holidayIndex: -1,
  customDate: getTomorrow(),
  customCheckout: getDefaultCheckout(),
};

function loadPrefs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultPrefs, ...parsed };
    }
  } catch {}
  return defaultPrefs;
}

export function usePreferences() {
  const [prefs, setPrefs] = useState(loadPrefs);

  const updatePrefs = useCallback((updates) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [prefs, updatePrefs];
}
