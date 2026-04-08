import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { formatDate, addDays, calcNights } from './shared.js';

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE = process.env.DYNAMODB_TABLE;

// ── User Settings ──

export async function getUserSettings(userId) {
  const { Item } = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: 'SETTINGS' },
  }));
  return Item || null;
}

export async function putUserSettings(userId, settings) {
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: `USER#${userId}`, SK: 'SETTINGS', ...settings, updatedAt: new Date().toISOString() },
  }));
}

// ── Favourites ──

export async function getFavourites(userId) {
  const { Items } = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'FAV#' },
  }));
  return (Items || []).map(item => ({
    id: item.SK.replace('FAV#', ''),
    name: item.name,
    checkIn: item.checkIn,
    checkOut: item.checkOut,
    nights: item.nights || [],
    createdAt: item.createdAt,
  }));
}

export async function putFavourite(userId, fav) {
  const id = fav.id || Date.now().toString();
  const numNights = calcNights(fav.checkIn, fav.checkOut);
  const start = new Date(fav.checkIn + 'T00:00:00');

  // Auto-split into per-night entries
  const nights = [];
  for (let i = 0; i < numNights; i++) {
    const date = formatDate(addDays(start, i));
    const nextDate = formatDate(addDays(start, i + 1));
    nights.push({
      date,
      nextDate,
      status: 'monitoring',  // monitoring | available | booked
      lastChecked: null,
    });
  }

  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: `FAV#${id}`,
      name: fav.name,
      checkIn: fav.checkIn,
      checkOut: fav.checkOut,
      nights,
      createdAt: new Date().toISOString(),
    },
  }));
  return id;
}

export async function deleteFavourite(userId, favId) {
  await db.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
  }));
}

// Mark a specific night as "booked" → stop monitoring it
export async function markNightBooked(userId, favId, nightDate) {
  // Get current item
  const { Item } = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
  }));
  if (!Item) return;

  const nights = Item.nights.map(n =>
    n.date === nightDate ? { ...n, status: 'booked' } : n
  );

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
    UpdateExpression: 'SET nights = :n',
    ExpressionAttributeValues: { ':n': nights },
  }));
}

// Update a night's status and lastChecked (used by cron)
export async function updateNightStatus(userId, favId, nightDate, status) {
  const { Item } = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
  }));
  if (!Item) return;

  const nights = Item.nights.map(n =>
    n.date === nightDate ? { ...n, status, lastChecked: new Date().toISOString() } : n
  );

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
    UpdateExpression: 'SET nights = :n',
    ExpressionAttributeValues: { ':n': nights },
  }));
}

// Update full period status (used by cron)
export async function updateFullPeriodStatus(userId, favId, status) {
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
    UpdateExpression: 'SET fullPeriodStatus = :s, fullPeriodChecked = :t',
    ExpressionAttributeValues: { ':s': status, ':t': new Date().toISOString() },
  }));
}

// ── Scan all favourites with monitoring nights (for cron) ──

export async function getAllActiveFavourites() {
  const { Items } = await db.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':sk': 'FAV#' },
  }));

  const results = [];
  const today = new Date().toISOString().split('T')[0];

  for (const item of (Items || [])) {
    const monitoringNights = (item.nights || []).filter(
      n => n.status === 'monitoring' && n.date >= today
    );
    if (monitoringNights.length > 0) {
      results.push({
        userId: item.PK.replace('USER#', ''),
        favId: item.SK.replace('FAV#', ''),
        name: item.name,
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        fullPeriodStatus: item.fullPeriodStatus || null,
        nights: monitoringNights,
      });
    }
  }
  return results;
}
