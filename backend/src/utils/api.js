import { API_BASE, BASE_PARAMS } from './shared.js';

export async function fetchAvailability(date, period) {
  const params = new URLSearchParams({ ...BASE_PARAMS, date, period });
  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) throw new Error(`BookEasy API error: ${response.status}`);
  return response.json();
}

// Unit-level availability
const UNIT_API_BASE = 'https://webapi.bookeasy.com.au/api/getAccomUnitRates';

export async function fetchUnitAvailability(date, period, unitIds) {
  const params = new URLSearchParams({
    q: 114, operators: '33314', date, period, adults: 2, children: 0, infants: 0,
  });
  if (unitIds?.length > 0) params.set('units', unitIds.join(','));
  const response = await fetch(`${UNIT_API_BASE}?${params}`);
  if (!response.ok) throw new Error(`Unit API error: ${response.status}`);
  return response.json();
}

export function parseUnitAvailability(data, filterIds) {
  const results = [];
  const items = data?.Data || data || [];
  for (const op of (Array.isArray(items) ? items : [])) {
    for (const room of (op.Items || [])) {
      for (const unit of (room.U || [])) {
        if (filterIds && !filterIds.includes(unit.Id)) continue;
        results.push({ unitId: unit.Id, available: unit.A === 1 });
      }
    }
  }
  return results;
}

export function parseAvailability(data) {
  const available = [];
  for (const operator of data) {
    for (const item of operator.Items) {
      if (item.Availability?.IsAvailable) {
        const hasStock = item.Availability.Days.some(
          (day) => day.IsAvailable && (!day.NumAvailable || day.NumAvailable > 0)
        );
        if (hasStock) {
          available.push({
            operator: operator.OperatorName,
            name: item.Name,
            cost: item.Availability.Cost,
            numAvailable: item.Availability.Days[0]?.NumAvailable || 0,
          });
        }
      }
    }
  }
  return available;
}
