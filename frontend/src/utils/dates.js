const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()} (${DAY_NAMES[date.getDay()]})`;
}

export function getWeekendDates(weeksFromNow = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Fri/Sat/Sun → go back to this Friday; Mon-Thu → go forward to this Friday
  let daysToFriday;
  if (dayOfWeek === 5) {
    daysToFriday = 0;
  } else if (dayOfWeek === 6) {
    daysToFriday = -1; // Saturday → go back 1 day to Friday
  } else if (dayOfWeek === 0) {
    daysToFriday = -2; // Sunday → go back 2 days to Friday
  } else {
    daysToFriday = 5 - dayOfWeek; // Mon-Thu → advance to Friday
  }
  daysToFriday += weeksFromNow * 7;

  const friday = new Date(today);
  friday.setDate(today.getDate() + daysToFriday);

  const saturday = new Date(friday);
  saturday.setDate(friday.getDate() + 1);

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  return { friday, saturday, sunday };
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

export function isHolidayPast(holiday) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(holiday.date);
  end.setDate(end.getDate() + holiday.nights);
  return end < today;
}
