const API_BASE = 'https://webapi.bookeasy.com.au/be/getAccomRatesGrid';
const BASE_PARAMS = {
  q: 114,
  InclAvailability: true,
  operators: '33314,141066,141069',
};

export async function fetchAvailability(date, period) {
  const params = new URLSearchParams({
    ...BASE_PARAMS,
    date,
    period,
  });

  const response = await fetch(`${API_BASE}?${params}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

// Unit-level availability (specific campsites like #298, #299)
const UNIT_API_BASE = 'https://webapi.bookeasy.com.au/api/getAccomUnitRates';

export async function fetchUnitAvailability(date, period, unitIds) {
  const params = new URLSearchParams({
    q: 114,
    operators: '33314',
    date,
    period,
    adults: 2,
    children: 0,
    infants: 0,
  });
  if (unitIds && unitIds.length > 0) {
    params.set('units', unitIds.join(','));
  }
  const response = await fetch(`${UNIT_API_BASE}?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unit API request failed: ${response.status}`);
  return response.json();
}

export function parseUnitAvailability(data, filterIds) {
  const results = [];
  const items = data?.Data || data || [];
  for (const operator of (Array.isArray(items) ? items : [])) {
    for (const room of (operator.Items || [])) {
      const units = room.U || [];
      for (const unit of units) {
        if (filterIds && !filterIds.includes(unit.Id)) continue;
        results.push({
          unitId: unit.Id,
          roomName: room.Name || room.Id,
          available: unit.A === 1,
          cost: room.Cost || 0,
        });
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
            operatorId: operator.OperatorId,
            name: item.Name,
            itemId: item.Id,
            cost: item.Availability.Cost,
            numAvailable: item.Availability.Days[0]?.NumAvailable || 'unknown',
          });
        }
      }
    }
  }

  return available;
}
