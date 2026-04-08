import { API_BASE, BASE_PARAMS } from 'shared';

export async function fetchAvailability(date, period) {
  const params = new URLSearchParams({ ...BASE_PARAMS, date, period });
  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) throw new Error(`BookEasy API error: ${response.status}`);
  return response.json();
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
