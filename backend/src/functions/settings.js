import { getUserSettings, putUserSettings } from '../utils/db.js';
import { json } from '../utils/response.js';

function getUserId(event) {
  return event.requestContext?.authorizer?.jwt?.claims?.sub;
}

export async function get(event) {
  try {
    const userId = getUserId(event);
    const settings = await getUserSettings(userId);
    return json(200, settings || { email: '' });
  } catch (e) {
    return json(500, { error: e.message });
  }
}

export async function update(event) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    await putUserSettings(userId, { email: body.email || '' });
    return json(200, { updated: true });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
