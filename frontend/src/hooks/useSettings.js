import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/auth';

const API = 'https://7iqek35q9i.execute-api.ap-southeast-2.amazonaws.com';

export function useSettings() {
  const [settings, setSettings] = useState({ email: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API}/api/settings`, { headers });
        const data = await res.json();
        setSettings(data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const updateEmail = useCallback(async (email) => {
    setSettings((prev) => ({ ...prev, email }));
    const headers = await getAuthHeaders();
    await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ email }),
    });
  }, []);

  return { settings, updateEmail, loading };
}
