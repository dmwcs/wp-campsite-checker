import { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const checkUser = async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch {
      setUser(null);
    }
    setChecking(false);
  };

  useEffect(() => {
    checkUser();
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') checkUser();
      if (payload.event === 'signedOut') setUser(null);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  return { user, checking, signOut: handleSignOut, refresh: checkUser };
}
