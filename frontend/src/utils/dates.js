const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function formatDisplayDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日(${DAY_NAMES[date.getDay()]})`;
}

export function getWeekendDates(weeksFromNow = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // 周五/六/日 → 回溯到本周五；周一~周四 → 前进到本周五
  let daysToFriday;
  if (dayOfWeek === 5) {
    daysToFriday = 0;
  } else if (dayOfWeek === 6) {
    daysToFriday = -1; // 周六 → 回退1天到周五
  } else if (dayOfWeek === 0) {
    daysToFriday = -2; // 周日 → 回退2天到周五
  } else {
    daysToFriday = 5 - dayOfWeek; // 周一~周四 → 前进到周五
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
