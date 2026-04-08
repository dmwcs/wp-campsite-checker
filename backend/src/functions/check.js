import { fetchAvailability, parseAvailability } from '../utils/api.js';
import { json } from '../utils/response.js';
import { calcNights, formatDate, addDays } from 'shared';

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { checkIn, checkOut } = body;
    if (!checkIn || !checkOut) {
      return json(400, { error: 'checkIn and checkOut are required' });
    }

    const nights = calcNights(checkIn, checkOut);
    if (nights <= 0 || nights > 14) {
      return json(400, { error: 'Invalid date range (1-14 nights)' });
    }

    // Full period query
    const fullData = await fetchAvailability(checkIn, nights);
    const fullAvail = parseAvailability(fullData);

    // Per-night queries
    const start = new Date(checkIn + 'T00:00:00');
    const nightPromises = [];
    for (let i = 0; i < nights; i++) {
      nightPromises.push(fetchAvailability(formatDate(addDays(start, i)), 1));
    }
    const nightResults = await Promise.all(nightPromises);
    const perNight = nightResults.map(data => parseAvailability(data));

    return json(200, {
      checkIn,
      checkOut,
      nights,
      fullPeriod: fullAvail,
      perNight,
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
