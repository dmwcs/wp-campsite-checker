import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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
    notify: item.notify ?? true,
    lastStatus: item.lastStatus || null,
    lastChecked: item.lastChecked || null,
  }));
}

export async function putFavourite(userId, fav) {
  const id = fav.id || Date.now().toString();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: `FAV#${id}`,
      name: fav.name,
      checkIn: fav.checkIn,
      checkOut: fav.checkOut,
      notify: fav.notify ?? true,
      lastStatus: null,
      lastChecked: null,
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

export async function updateFavouriteStatus(userId, favId, status) {
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `FAV#${favId}` },
    UpdateExpression: 'SET lastStatus = :s, lastChecked = :t',
    ExpressionAttributeValues: { ':s': status, ':t': new Date().toISOString() },
  }));
}

// ── Scan all users with notify favourites (for cron) ──

export async function getAllActiveFavourites() {
  const { Items } = await db.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'begins_with(SK, :sk) AND notify = :n',
    ExpressionAttributeValues: { ':sk': 'FAV#', ':n': true },
  }));
  return (Items || []).map(item => ({
    userId: item.PK.replace('USER#', ''),
    favId: item.SK.replace('FAV#', ''),
    name: item.name,
    checkIn: item.checkIn,
    checkOut: item.checkOut,
    lastStatus: item.lastStatus,
  }));
}
