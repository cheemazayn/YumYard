import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

// One cart per restaurant branch, kept in the browser so a refresh does not lose it
export function CartProvider({ children }) {
  const [state, setState] = useState(() => { try { return JSON.parse(localStorage.getItem('yy_cart')) || { key: '', items: [] }; } catch { return { key: '', items: [] }; } });
  useEffect(() => localStorage.setItem('yy_cart', JSON.stringify(state)), [state]);

  const api = useMemo(() => ({
    items: state.items,
    key: state.key,
    count: state.items.reduce((s, i) => s + i.qty, 0),
    subtotal: state.items.reduce((s, i) => s + i.price * i.qty, 0),
    start: (key) => setState((s) => (s.key === key ? s : { key, items: [] })),
    add: (item, price) => setState((s) => {
      const found = s.items.find((i) => i._id === item._id);
      return { ...s, items: found ? s.items.map((i) => (i._id === item._id ? { ...i, qty: i.qty + 1, price } : i)) : [...s.items, { _id: item._id, name: item.name, image: item.image, price, qty: 1 }] };
    }),
    setQty: (id, qty) => setState((s) => ({ ...s, items: qty <= 0 ? s.items.filter((i) => i._id !== id) : s.items.map((i) => (i._id === id ? { ...i, qty } : i)) })),
    clear: () => setState((s) => ({ ...s, items: [] })),
  }), [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
