import axios from 'axios';
import { io } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL || '';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('yy_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && localStorage.getItem('yy_token')) {
    localStorage.removeItem('yy_token');
    window.dispatchEvent(new Event('yy-logout'));
  }
  return Promise.reject(err);
});

export const errMsg = (e) => e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check that the API is running.' : e?.message) || 'Something went wrong.';

let socket;
export const getSocket = () => (socket ||= io(SERVER || undefined, { transports: ['websocket', 'polling'] }));

export const money = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;
export const imgUrl = (u) => (u && u.startsWith('/uploads') ? SERVER + u : u);
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const fmtDateTime = (d) => `${fmtDate(d)}, ${fmtTime(d)}`;
export const label = (s = '') => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Order status presentation
export const STATUS_STYLE = {
  pending: 'bg-saffron-light text-saffron-dark', confirmed: 'bg-blue-50 text-blue-700', in_kitchen: 'bg-orange-50 text-orange-700',
  ready: 'bg-forest-light text-forest', out_for_delivery: 'bg-purple-50 text-purple-700', delivered: 'bg-mist text-ink/70',
  rejected: 'bg-chili-light text-chili', cancelled: 'bg-chili-light text-chili',
};
export const statusText = (s, type) => (s === 'ready' && type === 'delivery' ? 'Packed' : s === 'ready' ? 'Ready' : s === 'in_kitchen' ? 'In kitchen' : label(s));

// Photography used across the public pages
export const PHOTOS = {
  hero: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80',
  kitchen: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80',
  interior: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
  interior2: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  spread: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  table: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=80',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  bowl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  dessert: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
  steak: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  restaurant: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80',
};
