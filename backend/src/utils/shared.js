// Inline shared constants and utils to avoid workspace resolution issues in Lambda

export const API_BASE = 'https://webapi.bookeasy.com.au/be/getAccomRatesGrid';

export const BASE_PARAMS = {
  q: 114,
  InclAvailability: true,
  operators: '33314,141066,141069',
};

export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function calcNights(checkIn, checkOut) {
  const a = new Date(checkIn + 'T00:00:00');
  const b = new Date(checkOut + 'T00:00:00');
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}
