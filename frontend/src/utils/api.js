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

  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }
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
            operatorId: operator.OperatorId,
            name: item.Name,
            itemId: item.Id,
            cost: item.Availability.Cost,
            numAvailable: item.Availability.Days[0]?.NumAvailable || '未知',
          });
        }
      }
    }
  }

  return available;
}
