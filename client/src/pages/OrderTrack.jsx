import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Clock, ChefHat, PackageCheck, Bike, CircleCheck, XCircle, Gamepad2, Gift, Ticket, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, getSocket, money, label, STATUS_STYLE, fmtTime } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLoad, Loading, ErrorBox, Stars, Field } from '../components/ui';
import { MemoryGame, TapGame } from '../games/Games';
import Navbar from '../components/Navbar';

const STEPS = (type) => [
  { s: 'pending', t: 'Order sent', i: Clock }, { s: 'confirmed', t: 'Accepted', i: Check }, { s: 'in_kitchen', t: 'In the kitchen', i: ChefHat },
  { s: 'ready', t: type === 'delivery' ? 'Packed' : type === 'takeaway' ? 'Ready for pickup' : 'Ready to serve', i: PackageCheck },
  ...(type === 'delivery' ? [{ s: 'out_for_delivery', t: 'Out for delivery', i: Bike }] : []),
  { s: 'delivered', t: type === 'dine-in' ? 'Served' : type === 'delivery' ? 'Delivered' : 'Picked up', i: CircleCheck },
];
const pad = (n) => String(n).padStart(2, '0');

function Review({ order, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/public/reviews', { orderId: order._id, rating, comment }); toast.success('Thank you for your feedback'); onDone(); }
    catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
      <div><h2 className="text-xl font-bold">How was your meal?</h2><p className="text-sm text-ink/60">Your rating helps {order.restaurant.name} improve.</p></div>
      <Stars value={rating} size={30} onChange={setRating} />
      <Field label="Tell us more (optional)"><textarea className="input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="The food, the service, the wait..." /></Field>
      <button className="btn-primary" disabled={busy || !rating}>{busy ? 'Sending' : 'Submit review'}</button>
    </form>
  );
}

export default function OrderTrack() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: order, setData, loading, error, reload } = useLoad(async () => (await api.get(`/public/orders/${id}`)).data, [id]);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [game, setGame] = useState('memory');
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => { if (order?.serverNow) setOffset(order.serverNow - Date.now()); }, [order?.serverNow]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const s = getSocket();
    s.emit('join', `order:${id}`);
    const h = (u) => { if (u._id === id) { setData((o) => ({ ...o, ...u })); toast(`Order update: ${label(u.status)}`); } };
    s.on('order:update', h);
    return () => s.off('order:update', h);
  }, [id, setData]);

  const steps = useMemo(() => (order ? STEPS(order.type) : []), [order]);
  if (loading && !order) return <><Navbar /><Loading text="Finding your order" /></>;
  if (error) return <><Navbar /><main className="mx-auto max-w-lg px-5 pt-32"><ErrorBox message={error} retry={reload} /></main></>;

  const dead = ['rejected', 'cancelled'].includes(order.status);
  const done = order.status === 'delivered';
  const idx = Math.max(0, steps.findIndex((x) => x.s === order.status));
  const deadline = new Date(order.createdAt).getTime() + order.estimatedMinutes * 60000;
  const left = Math.round((deadline - (now - offset)) / 1000);
  const total = order.estimatedMinutes * 60;
  const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
  const active = !dead && !done;
  const color = order.restaurant.theme?.primary || '#1F4D3A';

  const finishGame = async (score) => {
    try {
      const { data } = await api.post(`/public/orders/${id}/game`, { game, score });
      setResult(data);
      if (data.reward) toast.success(`You earned ${data.reward.value}% off your next order: ${data.reward.code}`, { duration: 7000 });
    } catch (e) { toast.error(errMsg(e)); }
  };
  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try { await api.post(`/public/orders/${id}/cancel`); reload(); toast.success('Order cancelled'); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-28">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-ink/60"><span>Order {order.orderNo}</span><span>·</span><Link to={`/r/${order.restaurant.slug}`} className="font-semibold text-forest">{order.restaurant.name}</Link><span>·</span><span>{order.branch.name}</span></div>
        <h1 className="text-3xl font-extrabold">{dead ? (order.status === 'rejected' ? 'The restaurant could not take this order' : 'Order cancelled') : done ? 'Enjoy your meal' : order.status === 'pending' ? 'Waiting for the restaurant to accept' : 'Your order is on its way'}</h1>

        {dead && (
          <div className="mt-5 flex gap-3 rounded-lg border border-chili/30 bg-chili-light p-4 text-sm text-chili"><XCircle className="shrink-0" size={20} />
            <div><p className="font-semibold">{order.rejectReason || 'No reason was given.'}</p>{order.paymentStatus === 'refunded' && <p className="mt-1">Your payment of {money(order.total)} has been refunded.</p>}</div></div>
        )}

        {active && (
          <section className="card mt-6 p-6 text-center" aria-live="polite">
            <p className="text-sm font-semibold text-ink/60">{left > 0 ? 'Estimated time left' : 'Running a little late'}</p>
            <p className={`mt-1 font-display text-6xl font-extrabold tabular-nums ${left <= 0 ? 'text-chili' : ''}`}>{left > 0 ? `${pad(Math.floor(left / 60))}:${pad(left % 60)}` : `+${pad(Math.floor(-left / 60))}:${pad(-left % 60)}`}</p>
            <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded bg-mist"><div className="h-full rounded transition-all duration-1000" style={{ width: `${pct}%`, background: left <= 0 ? '#C7402D' : color }} /></div>
            {left <= 0 && <p className="mt-3 text-sm text-ink/60">The kitchen is on it. We will update this page the moment it is ready.</p>}
          </section>
        )}

        {!dead && (
          <ol className="mt-6 grid gap-2 sm:grid-cols-5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((x, i) => {
              const reached = i <= idx; const I = x.i;
              return (
                <li key={x.s} className="flex flex-col items-center gap-1.5 text-center" aria-current={i === idx ? 'step' : undefined}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${reached ? 'text-white' : 'bg-mist text-ink/40'} ${i === idx && active ? 'pulse-ring' : ''}`} style={reached ? { background: color } : {}}><I size={18} /></span>
                  <span className={`text-xs font-semibold ${reached ? '' : 'text-ink/40'}`}>{x.t}</span>
                  {order.timeline?.find((t) => t.status === x.s) && <span className="text-[11px] text-ink/50">{fmtTime(order.timeline.find((t) => t.status === x.s).at)}</span>}
                </li>
              );
            })}
          </ol>
        )}

        {active && (
          <section className="card mt-8 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Gamepad2 size={20} /> While you wait</h2>
              <div className="flex gap-1">{[['memory', 'Memory match'], ['tap', 'Tap the dish']].map(([g, t]) => <button key={g} onClick={() => { setGame(g); setResult(null); setRound((r) => r + 1); }} className={`btn btn-sm ${game === g ? 'bg-forest text-white' : 'btn-outline'}`}>{t}</button>)}</div>
            </div>
            {result ? (
              <div className="rounded-lg bg-forest-light p-5 text-center">
                <p className="font-display text-4xl font-extrabold text-forest">{result.score}<span className="text-lg">/100</span></p>
                <p className="mt-1 text-sm">You earned <b>{result.points} points</b>{result.totalPoints != null && <> (you now have {result.totalPoints})</>}.</p>
                {result.reward && <p className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-md bg-saffron px-3 py-2 text-sm font-bold"><Ticket size={16} /> {result.reward.value}% off next order: {result.reward.code}</p>}
                {!user && <p className="mt-2 text-xs text-ink/60"><Link to="/register" className="font-semibold text-forest underline">Create an account</Link> to keep your points.</p>}
                <button className="btn-primary mt-4" onClick={() => { setResult(null); setRound((r) => r + 1); }}>Play again</button>
              </div>
            ) : game === 'memory' ? <MemoryGame key={round} onFinish={finishGame} /> : <TapGame key={round} onFinish={finishGame} />}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink/50"><Gift size={13} /> Score 80 or more to win a small discount code. Points can be redeemed from your account.</p>
          </section>
        )}

        <section className="card mt-6 divide-y divide-ink/10">
          <div className="flex items-center justify-between p-4"><span className={`badge ${STATUS_STYLE[order.status]}`}>{label(order.status)}</span><span className="text-sm text-ink/60">{label(order.type)}{order.tableNo ? ` · Table ${order.tableNo}` : ''}</span></div>
          <ul className="space-y-1.5 p-4 text-sm">{order.items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty} x {i.name}</span><span>{money(i.price * i.qty)}</span></li>)}</ul>
          <dl className="space-y-1 p-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-forest"><dt>Discount ({order.coupon})</dt><dd>- {money(order.discount)}</dd></div>}
            {order.tax > 0 && <div className="flex justify-between"><dt className="text-ink/60">Tax</dt><dd>{money(order.tax)}</dd></div>}
            {order.serviceFee > 0 && <div className="flex justify-between"><dt className="text-ink/60">Service fee</dt><dd>{money(order.serviceFee)}</dd></div>}
            <div className="flex justify-between pt-1 font-display text-lg font-extrabold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
            <div className="flex justify-between text-xs text-ink/60"><dt>Payment</dt><dd>{label(order.paymentMethod)} · {label(order.paymentStatus)}</dd></div>
          </dl>
          {order.type === 'delivery' && order.address && <p className="flex items-start gap-2 p-4 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-ink/50" />{order.address}</p>}
        </section>

        {order.status === 'pending' && <button className="btn-outline mt-4" onClick={cancel}>Cancel order</button>}
        {done && !order.reviewed && <Review order={order} onDone={() => setData({ ...order, reviewed: true })} />}
        {done && order.reviewed && <p className="mt-6 text-center text-sm text-ink/60">Thanks for your review.</p>}
      </main>
    </>
  );
}
