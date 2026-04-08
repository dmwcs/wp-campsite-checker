import { useState, useCallback } from 'react';

const STORAGE_KEY = 'wp-favourites';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function useFavourites() {
  const [favourites, setFavourites] = useState(load);

  const addFavourite = useCallback((fav) => {
    setFavourites((prev) => {
      const next = [...prev, { ...fav, id: Date.now() }];
      save(next);
      return next;
    });
  }, []);

  const removeFavourite = useCallback((id) => {
    setFavourites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { favourites, addFavourite, removeFavourite };
}
