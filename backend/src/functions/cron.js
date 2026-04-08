import { getAllActiveFavourites, updateNightStatus, updateFullPeriodStatus, getUserSettings } from '../utils/db.js';
import { fetchAvailability, parseAvailability } from '../utils/api.js';
import { calcNights } from '../utils/shared.js';

export async function handler() {
  console.log('Cron: checking all active favourites...');

  const allFavs = await getAllActiveFavourites();
  console.log(`Cron: ${allFavs.length} favourites with monitoring nights`);

  if (allFavs.length === 0) return { statusCode: 200, body: 'No active favourites' };

  // Collect all unique dates that need checking
  const datesToCheck = new Set();
  for (const fav of allFavs) {
    for (const night of fav.nights) {
      datesToCheck.add(night.date);
    }
  }

  // Query each unique date once (1 night each)
  const dateResults = {};
  await Promise.all([...datesToCheck].map(async (date) => {
    try {
      const data = await fetchAvailability(date, 1);
      dateResults[date] = parseAvailability(data);
    } catch (e) {
      console.error(`Cron: API error for ${date}:`, e.message);
      dateResults[date] = null;
    }
  }));

  // Query full periods (deduplicated by checkIn+checkOut)
  const fullPeriodResults = {};
  const periodKeys = new Set();
  for (const fav of allFavs) {
    const key = `${fav.checkIn}|${fav.checkOut}`;
    if (!periodKeys.has(key)) {
      periodKeys.add(key);
      const nights = calcNights(fav.checkIn, fav.checkOut);
      if (nights > 1) {
        try {
          const data = await fetchAvailability(fav.checkIn, nights);
          fullPeriodResults[key] = parseAvailability(data);
        } catch (e) {
          console.error(`Cron: full period API error for ${key}:`, e.message);
          fullPeriodResults[key] = null;
        }
      }
    }
  }

  // Check each favourite
  for (const fav of allFavs) {
    const notifications = [];

    // Check per-night
    for (const night of fav.nights) {
      const available = dateResults[night.date];
      if (available === null) continue;

      const hasAvailability = available.length > 0;
      const wasAvailable = night.status === 'available';
      const newStatus = hasAvailability ? 'available' : 'monitoring';

      if (newStatus !== night.status) {
        await updateNightStatus(fav.userId, fav.favId, night.date, newStatus);
      }

      if (hasAvailability && !wasAvailable) {
        notifications.push({ type: 'night', date: night.date, nextDate: night.nextDate, sites: available });
      }
    }

    // Check full period
    const periodKey = `${fav.checkIn}|${fav.checkOut}`;
    const fullAvail = fullPeriodResults[periodKey];
    if (fullAvail !== null && fullAvail !== undefined) {
      const fullHasAvail = fullAvail.length > 0;
      const wasFullAvail = fav.fullPeriodStatus === 'available';
      const newFullStatus = fullHasAvail ? 'available' : 'full';

      if (newFullStatus !== fav.fullPeriodStatus) {
        await updateFullPeriodStatus(fav.userId, fav.favId, newFullStatus);
      }

      if (fullHasAvail && !wasFullAvail) {
        const nights = calcNights(fav.checkIn, fav.checkOut);
        notifications.push({ type: 'full', checkIn: fav.checkIn, checkOut: fav.checkOut, nights, sites: fullAvail });
      }
    }

    // Send notification if anything new
    if (notifications.length > 0) {
      try {
        const settings = await getUserSettings(fav.userId);
        if (settings?.email) {
          await sendNotification(settings.email, fav.name, notifications);
          console.log(`Cron: email sent to ${settings.email} for ${fav.name}`);
        }
      } catch (e) {
        console.error(`Cron: email error for ${fav.userId}:`, e.message);
      }
    }
  }

  return { statusCode: 200, body: 'Done' };
}

async function sendNotification(toEmail, favName, notifications) {
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
  const ses = new SESClient({});

  const sections = notifications.map(n => {
    const siteList = n.sites.map(s => `    ${s.name} — $${s.cost}/night, ${s.numAvailable} left`).join('\n');
    if (n.type === 'full') {
      return `  FULL PERIOD: ${n.checkIn} → ${n.checkOut} (${n.nights} nights)\n${siteList}`;
    }
    return `  ${n.date} → ${n.nextDate} (1 night)\n${siteList}`;
  }).join('\n\n');

  const hasFullPeriod = notifications.some(n => n.type === 'full');
  const subject = hasFullPeriod
    ? `🏕️ ${favName} — Full period available!`
    : `🏕️ ${favName} — Spots available!`;

  const body = `Availability change detected for "${favName}":

${sections}

Book now: https://bookings.parks.vic.gov.au/book#

---
Sent by WP Campsite Checker
`;

  await ses.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: body, Charset: 'UTF-8' } },
    },
  }));
}
