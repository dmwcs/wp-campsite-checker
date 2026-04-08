import { useState, useCallback, useEffect } from 'react';
import { getAuthHeaders } from '../utils/auth';

const API = 'https://7iqek35q9i.execute-api.ap-southeast-2.amazonaws.com';

export function useFavourites() {
  const [favourites, setFavourites] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFavourites = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/favourites`, { headers });
      const data = await res.json();
      setFavourites(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadFavourites(); }, [loadFavourites]);

  const addFavourite = useCallback(async (fav) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API}/api/favourites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(fav),
    });
    const { id } = await res.json();
    await loadFavourites(); // reload to get the auto-split nights
    return id;
  }, [loadFavourites]);

  const removeFavourite = useCallback(async (id) => {
    const headers = await getAuthHeaders();
    await fetch(`${API}/api/favourites/${id}`, { method: 'DELETE', headers });
    setFavourites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const markBooked = useCallback(async (favId, nightDate) => {
    const headers = await getAuthHeaders();
    await fetch(`${API}/api/favourites/${favId}/booked`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ date: nightDate }),
    });
    // Update local state
    setFavourites((prev) => prev.map(fav => {
      if (fav.id !== favId) return fav;
      return {
        ...fav,
        nights: fav.nights.map(n => n.date === nightDate ? { ...n, status: 'booked' } : n),
      };
    }));
  }, []);

  const unmarkBooked = useCallback(async (favId, nightDate) => {
    const headers = await getAuthHeaders();
    await fetch(`${API}/api/favourites/${favId}/unbook`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ date: nightDate }),
    });
    setFavourites((prev) => prev.map(fav => {
      if (fav.id !== favId) return fav;
      return {
        ...fav,
        nights: fav.nights.map(n => n.date === nightDate ? { ...n, status: 'monitoring' } : n),
      };
    }));
  }, []);

  return { favourites, addFavourite, removeFavourite, markBooked, unmarkBooked, loading, reload: loadFavourites };
}
