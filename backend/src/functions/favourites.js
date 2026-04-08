import { getFavourites, putFavourite, deleteFavourite } from '../utils/db.js';
import { json } from '../utils/response.js';

// TODO: replace with Cognito user ID from JWT
function getUserId(event) {
  return event.requestContext?.authorizer?.jwt?.claims?.sub || 'default-user';
}

export async function list(event) {
  try {
    const userId = getUserId(event);
    const favourites = await getFavourites(userId);
    return json(200, favourites);
  } catch (e) {
    return json(500, { error: e.message });
  }
}

export async function create(event) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    if (!body.checkIn || !body.checkOut) {
      return json(400, { error: 'checkIn and checkOut are required' });
    }
    const id = await putFavourite(userId, {
      name: body.name || `${body.checkIn} → ${body.checkOut}`,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
    });
    return json(201, { id });
  } catch (e) {
    return json(500, { error: e.message });
  }
}

export async function remove(event) {
  try {
    const userId = getUserId(event);
    const favId = event.pathParameters?.id;
    if (!favId) return json(400, { error: 'id is required' });
    await deleteFavourite(userId, favId);
    return json(200, { deleted: true });
  } catch (e) {
    return json(500, { error: e.message });
  }
}
