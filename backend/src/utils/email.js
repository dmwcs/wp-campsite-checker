import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

export async function sendNotification(toEmail, favName, checkIn, checkOut, availableItems) {
  const siteList = availableItems
    .map(i => `  • ${i.name} — $${i.cost}/晚, 剩${i.numAvailable}个`)
    .join('\n');

  const subject = `🏕️ ${favName} 有空位了！`;
  const body = `你关注的营地有空位了：

${favName}
${checkIn} → ${checkOut}

可用营地：
${siteList}

立即预订：https://bookings.parks.vic.gov.au/book#
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
