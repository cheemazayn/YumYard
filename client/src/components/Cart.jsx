import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag, CreditCard, Wallet, Smartphone, Tag, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Img, Field } from './ui';

const TYPES = [['dine-in', 'Dine in'], ['takeaway', 'Takeaway'], ['delivery', 'Delivery']];
const PAY = [['cash', 'Cash', Wallet], ['card', 'Card', CreditCard], ['online', 'Online wallet', Smartphone]];

export default function CartDrawer({ open, onClose, slug, branch, settings, menu, color }) {
  const cart = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ customerName: '', phone: '', type: 'dine-in', tableNo: '', address: '', note: '', paymentMethod: 'cash' });
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recs, setRecs] = useState({ reason: '', items: [] });

  useEffect(() => { if (user) setF((p) => ({ ...p, customerName: p.customerName || user.name, phone: p.phone || user.phone || '' })); }, [user]);

  const ids = cart.items.map((i) => i._id).join(',');
  useEffect(() => {
    if (!open || !cart.items.length) return;
    api.get(`/public/restaurants/${slug}/recommend`, { params: { branch, items: ids } }).then((r) => setRecs(r.data)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ids, slug, branch]);

  const subtotal = cart.subtotal;
  const discount = coupon?.discount || 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * (settings?.taxRate || 0)) / 100);
  const fee = Math.round((taxable * (settings?.serviceFee || 0)) / 100);
  const total = taxable + tax + fee;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const priceOf = useMemo(() => Object.fromEntries((menu || []).map((m) => [m._id, m.livePrice])), [menu]);

  useEffect(() => { if (coupon) setCoupon(null); /* subtotal changed, re-validate */ // eslint-disable-next-line
  }, [subtotal]);

  const applyCode = async () => {
    if (!code.trim()) return;
    try { const { data } = await api.post('/public/coupons/validate', { slug, branch, code, subtotal }); setCoupon(data); toast.success(`${data.code} applied`); }
    catch (e) { setCoupon(null); toast.error(errMsg(e)); }
  };

  const place = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/public/orders', {
        slug, branchId: branch, items: cart.items.map((i) => ({ menuItem: i._id, qty: i.qty })), couponCode: coupon?.code, ...f,
        card: f.paymentMethod === 'card' ? card : undefined,
      });
      cart.clear(); onClose(); toast.success('Order placed. The restaurant will confirm it shortly.');
      nav(`/track/${data._id}`);
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-lift" aria-label="Your order">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingBag size={18} /> Your order</h2>
          <button onClick={onClose} aria-label="Close cart" className="rounded p-1 hover:bg-ink/5"><X size={18} /></button>
        </div>

        {!cart.items.length ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><ShoppingBag size={36} className="mb-3 text-ink/25" /><p className="font-display text-lg font-bold">Your cart is empty</p><p className="mt-1 text-sm text-ink/60">Add a dish from the menu to get started.</p></div>
        ) : (
          <form onSubmit={place} className="flex-1 space-y-5 overflow-y-auto p-5">
            <ul className="space-y-3">
              {cart.items.map((i) => (
                <li key={i._id} className="flex items-center gap-3">
                  <Img src={i.image} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.name}</p><p className="text-xs text-ink/60">{money(priceOf[i._id] ?? i.price)} each</p></div>
                  <div className="flex items-center gap-1.5 rounded-md border border-ink/15 px-1">
                    <button type="button" onClick={() => cart.setQty(i._id, i.qty - 1)} className="p-1" aria-label={`Remove one ${i.name}`}><Minus size={14} /></button>
                    <span className="w-5 text-center text-sm font-semibold">{i.qty}</span>
                    <button type="button" onClick={() => cart.setQty(i._id, i.qty + 1)} className="p-1" aria-label={`Add one ${i.name}`}><Plus size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>

            {recs.items.length > 0 && (
              <div className="rounded-lg bg-forest-light p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-forest"><Sparkles size={13} /> {recs.reason}</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recs.items.map((m) => (
                    <button type="button" key={m._id} onClick={() => cart.add(m, m.price)} className="w-28 shrink-0 rounded-md bg-white p-1.5 text-left shadow-sm">
                      <Img src={m.image} className="h-16 w-full rounded object-cover" /><p className="mt-1 truncate text-xs font-semibold">{m.name}</p><p className="text-xs text-ink/60">+ {money(m.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="label">Promo code</span>
              <div className="flex gap-2">
                <div className="relative flex-1"><Tag size={14} className="absolute left-3 top-3 text-ink/40" /><input className="input pl-8 uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10" /></div>
                <button type="button" onClick={applyCode} className="btn-outline">Apply</button>
              </div>
              {coupon && <p className="mt-1 text-xs font-semibold text-forest">{coupon.code}: you save {money(coupon.discount)}</p>}
            </div>

            <div>
              <span className="label">How would you like it?</span>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(([v, l]) => <button type="button" key={v} onClick={() => setF({ ...f, type: v })} aria-pressed={f.type === v} className={`rounded-md border px-2 py-2 text-sm font-semibold ${f.type === v ? 'border-forest bg-forest text-white' : 'border-ink/20'}`}>{l}</button>)}
              </div>
            </div>
            {f.type === 'dine-in' && <Field label="Table number"><input className="input" value={f.tableNo} onChange={set('tableNo')} required /></Field>}
            {f.type === 'delivery' && (
              <Field label="Delivery address">
                {user?.addresses?.length > 0 && <select className="input mb-2" onChange={(e) => e.target.value && setF({ ...f, address: e.target.value })} defaultValue=""><option value="">Use a saved address</option>{user.addresses.map((a, i) => <option key={i} value={a.line}>{a.label}: {a.line}</option>)}</select>}
                <textarea className="input" rows={2} value={f.address} onChange={set('address')} required />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your name"><input className="input" value={f.customerName} onChange={set('customerName')} required /></Field>
              <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} required /></Field>
            </div>
            <Field label="Note for the kitchen (optional)"><input className="input" value={f.note} onChange={set('note')} /></Field>

            <div>
              <span className="label">Payment</span>
              <div className="grid grid-cols-3 gap-2">
                {PAY.map(([v, l, I]) => <button type="button" key={v} onClick={() => setF({ ...f, paymentMethod: v })} aria-pressed={f.paymentMethod === v} className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold ${f.paymentMethod === v ? 'border-forest bg-forest-light text-forest' : 'border-ink/20'}`}><I size={16} />{l}</button>)}
              </div>
              {f.paymentMethod === 'card' && (
                <div className="mt-3 space-y-2 rounded-md border border-ink/10 bg-paper p-3">
                  <input className="input" placeholder="Card number" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} />
                  <div className="grid grid-cols-2 gap-2"><input className="input" placeholder="MM/YY" autoComplete="cc-exp" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} maxLength={5} /><input className="input" placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} maxLength={4} /></div>
                  <p className="text-xs text-ink/50">Demo gateway: any valid test card works, for example 4242 4242 4242 4242.</p>
                </div>
              )}
              {f.paymentMethod === 'online' && <p className="mt-2 text-xs text-ink/50">You will be charged through the demo wallet gateway when you place the order.</p>}
              {f.paymentMethod === 'cash' && <p className="mt-2 text-xs text-ink/50">Pay with cash when your order is {f.type === 'delivery' ? 'delivered' : 'served'}.</p>}
            </div>

            <dl className="space-y-1.5 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{money(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-forest"><dt>Discount</dt><dd>- {money(discount)}</dd></div>}
              {tax > 0 && <div className="flex justify-between"><dt className="text-ink/60">Tax ({settings.taxRate}%)</dt><dd>{money(tax)}</dd></div>}
              {fee > 0 && <div className="flex justify-between"><dt className="text-ink/60">Service fee ({settings.serviceFee}%)</dt><dd>{money(fee)}</dd></div>}
              <div className="flex justify-between border-t border-ink/10 pt-2 font-display text-lg font-extrabold"><dt>Total</dt><dd>{money(total)}</dd></div>
            </dl>
            <button className="btn w-full py-3 text-white" style={{ background: color }} disabled={busy}>{busy ? 'Placing order' : f.paymentMethod === 'cash' ? `Place order, ${money(total)}` : `Pay ${money(total)} and order`}</button>
          </form>
        )}
      </aside>
    </div>
  );
}
