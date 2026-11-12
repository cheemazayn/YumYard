import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('yy_token'));

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('yy_token')) { setUser(null); setRestaurant(null); setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user); setRestaurant(data.restaurant);
    } catch { setUser(null); setRestaurant(null); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const out = () => { setUser(null); setRestaurant(null); };
    window.addEventListener('yy-logout', out);
    return () => window.removeEventListener('yy-logout', out);
  }, []);

  const signIn = async (token) => { localStorage.setItem('yy_token', token); setLoading(true); await refresh(); };
  const signOut = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('yy_token'); setUser(null); setRestaurant(null);
  };

  return <Ctx.Provider value={{ user, restaurant, loading, signIn, signOut, refresh, setUser }}>{children}</Ctx.Provider>;
}

export const homeFor = (user) => (!user ? '/' : user.role === 'admin' ? '/admin' : ['owner', 'manager', 'staff'].includes(user.role) ? '/dashboard' : '/account');
