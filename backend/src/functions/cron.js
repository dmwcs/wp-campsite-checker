import { getAllActiveFavourites, updateNightStatus, getUserSettings } from '../utils/db.js';
import { fetchAvailability, parseAvailability } from '../utils/api.js';

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

  // Check each favourite's monitoring nights
  for (const fav of allFavs) {
    const newlyAvailable = [];

    for (const night of fav.nights) {
      const available = dateResults[night.date];
      if (available === null) continue; // API error, skip

      const hasAvailability = available.length > 0;
      const wasAvailable = night.status === 'available';
      const newStatus = hasAvailability ? 'available' : 'monitoring';

      // Update status
      if (newStatus !== night.status) {
        await updateNightStatus(fav.userId, fav.favId, night.date, newStatus);
      }

      // Newly available → add to notification list
      if (hasAvailability && !wasAvailable) {
        newlyAvailable.push({ date: night.date, nextDate: night.nextDate, sites: available });
      }
    }

    // Send notification if any nights became available
    if (newlyAvailable.length > 0) {
      try {
        const settings = await getUserSettings(fav.userId);
        if (settings?.email) {
          await sendNightNotification(settings.email, fav.name, newlyAvailable);
          console.log(`Cron: email sent to ${settings.email} for ${fav.name}`);
        }
      } catch (e) {
        console.error(`Cron: email error for ${fav.userId}:`, e.message);
      }
    }
  }

  return { statusCode: 200, body: 'Done' };
}

async function sendNightNotification(toEmail, favName, nights) {
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
  const ses = new SESClient({});

  const nightDetails = nights.map(n => {
    const siteList = n.sites.map(s => `    ${s.name} — $${s.cost}/晚, 剩${s.numAvailable}个`).join('\n');
    return `  ${n.date} → ${n.nextDate}\n${siteList}`;
  }).join('\n\n');

  const subject = `🏕️ ${favName} 有空位了！`;
  const body = `你关注的「${favName}」有新空位：

${nightDetails}

立即预订：https://bookings.parks.vic.gov.au/book#

---
此邮件由 WP Campsite Checker 自动发送
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
