import { getAllActiveFavourites, updateFavouriteStatus, getUserSettings } from '../utils/db.js';
import { fetchAvailability, parseAvailability } from '../utils/api.js';
import { sendNotification } from '../utils/email.js';
import { calcNights } from 'shared';

export async function handler() {
  console.log('Cron: checking all active favourites...');

  const allFavs = await getAllActiveFavourites();
  const today = new Date().toISOString().split('T')[0];

  // Filter out expired favourites
  const activeFavs = allFavs.filter(f => f.checkIn > today);
  console.log(`Cron: ${activeFavs.length} active favourites to check`);

  if (activeFavs.length === 0) return { statusCode: 200, body: 'No active favourites' };

  // Deduplicate API calls: group by checkIn+checkOut
  const dateGroups = {};
  for (const fav of activeFavs) {
    const key = `${fav.checkIn}|${fav.checkOut}`;
    if (!dateGroups[key]) dateGroups[key] = { checkIn: fav.checkIn, checkOut: fav.checkOut, favs: [] };
    dateGroups[key].favs.push(fav);
  }

  // Query each unique date range once
  for (const group of Object.values(dateGroups)) {
    const nights = calcNights(group.checkIn, group.checkOut);
    if (nights <= 0) continue;

    let available;
    try {
      const data = await fetchAvailability(group.checkIn, nights);
      available = parseAvailability(data);
    } catch (e) {
      console.error(`Cron: API error for ${group.checkIn}-${group.checkOut}:`, e.message);
      continue;
    }

    const hasAvailability = available.length > 0;

    // Check each favourite in this group
    for (const fav of group.favs) {
      const wasAvailable = fav.lastStatus === 'available';
      const nowAvailable = hasAvailability;

      // Status changed from unavailable → available: send notification
      if (nowAvailable && !wasAvailable) {
        console.log(`Cron: availability found for ${fav.name} (user: ${fav.userId})`);
        try {
          const settings = await getUserSettings(fav.userId);
          if (settings?.email) {
            await sendNotification(settings.email, fav.name, fav.checkIn, fav.checkOut, available);
            console.log(`Cron: email sent to ${settings.email}`);
          }
        } catch (e) {
          console.error(`Cron: email error for ${fav.userId}:`, e.message);
        }
      }

      // Update status
      await updateFavouriteStatus(fav.userId, fav.favId, nowAvailable ? 'available' : 'unavailable');
    }
  }

  return { statusCode: 200, body: 'Done' };
}
