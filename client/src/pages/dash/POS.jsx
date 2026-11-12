import { useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, Printer, Wallet, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money, label, fmtDateTime } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useLoad, Loading, ErrorBox, PageHeader, Tabs, Img, Modal, Field, Empty, Badge } from '../../components/ui';
import Receipt, { printBill } from '../../components/Receipt';

const PAY = [['cash', 'Cash', Wallet], ['card', 'Card', CreditCard], ['online', 'Online', Smartphone]];

function Terminal() {
  const { branches, branch: ctxBranch } = useBranch();
  const [branch, setBranch] = useState(ctxBranch || '');
  const b = branch || branches[0]?._id || '';
  const { data, loading, error, reload } = useLoad(async () => b ? (await api.get('/manage/menu', { params: { branch: b } })).data : null, [b]);
  const [cart, setCart] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [f, setF] = useState({ type: 'dine-in', tableNo: '', customerName: '', phone: '', couponCode: '', paymentMethod: 'cash', paid: true });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const items = useMemo(() => (data?.items || []).filter((i) => i.available && (cat === 'all' || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase())), [data, q, cat]);
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const add = (m) => setCart((c) => (c.find((x) => x._id === m._id) ? c.map((x) => (x._id === m._id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { _id: m._id, name: m.name, price: m.price, qty: 1 }]));
  const setQty = (id, d) => setCart((c) => c.map((x) => (x._id === id ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const place = async () => {
    setBusy(true);
    try {
      const { data: order } = await api.post('/manage/pos', { branchId: b, items: cart.map((i) => ({ menuItem: i._id, qty: i.qty })), ...f });
      const { data: bill } = await api.get(`/manage/orders/${order._id}`);
      setDone(bill); setCart([]); setF({ ...f, tableNo: '', customerName: '', phone: '', couponCode: '' });
      toast.success(`Order ${order.orderNo} sent to the kitchen`);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section>
        <div className="mb-4 flex flex-wrap gap-3">
          {branches.length > 1 && <select className="input w-auto" value={b} onChange={(e) => { setBranch(e.target.value); setCart([]); }} aria-label="Branch">{branches.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select>}
          <div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-3 text-ink/40" /><input className="input pl-9" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {data && <div className="mb-4 flex gap-1 overflow-x-auto">{[{ _id: 'all', name: 'All' }, ...data.categories].map((c) => <button key={c._id} onClick={() => setCat(c._id)} className={`btn btn-sm whitespace-nowrap ${cat === c._id ? 'bg-forest text-white' : 'btn-outline'}`}>{c.name}</button>)}</div>}
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !items.length ? <Empty title="No dishes to show" hint="Add dishes to this branch's menu first." /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => (
              <button key={m._id} onClick={() => add(m)} className="card overflow-hidden text-left transition-shadow hover:shadow-lift">
                <Img src={m.image} alt="" className="h-24 w-full object-cover" /><div className="p-3"><p className="line-clamp-1 text-sm font-semibold">{m.name}</p><p className="text-sm text-ink/60">{money(m.price)}</p></div>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="card h-fit space-y-4 p-4 lg:sticky lg:top-20">
        <h2 className="font-bold">Current bill</h2>
        {!cart.length ? <p className="py-6 text-center text-sm text-ink/50">Tap a dish to add it.</p> : (
          <ul className="space-y-2">{cart.map((i) => (
            <li key={i._id} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate font-semibold">{i.name}</span>
              <div className="flex items-center gap-1 rounded border border-ink/15"><button className="p-1" onClick={() => setQty(i._id, -1)} aria-label="Fewer"><Minus size={13} /></button><span className="w-5 text-center">{i.qty}</span><button className="p-1" onClick={() => setQty(i._id, 1)} aria-label="More"><Plus size={13} /></button></div>
              <span className="w-20 text-right">{money(i.price * i.qty)}</span><button onClick={() => setCart(cart.filter((x) => x._id !== i._id))} aria-label="Remove"><Trash2 size={14} className="text-chili" /></button></li>))}</ul>
        )}
        <div className="grid grid-cols-3 gap-1.5">{['dine-in', 'takeaway', 'delivery'].map((t) => <button key={t} onClick={() => setF({ ...f, type: t })} className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${f.type === t ? 'border-forest bg-forest text-white' : 'border-ink/20'}`}>{label(t)}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">
          {f.type === 'dine-in' && <input className="input" placeholder="Table no." value={f.tableNo} onChange={(e) => setF({ ...f, tableNo: e.target.value })} />}
          <input className="input" placeholder="Customer name" value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} />
          <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className="input uppercase" placeholder="Coupon code" value={f.couponCode} onChange={(e) => setF({ ...f, couponCode: e.target.value })} />
        </div>
        <div>
          <span className="label">Payment</span>
          <div className="grid grid-cols-3 gap-1.5">{PAY.map(([v, l, I]) => <button key={v} onClick={() => setF({ ...f, paymentMethod: v })} className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-xs font-semibold ${f.paymentMethod === v ? 'border-forest bg-forest-light text-forest' : 'border-ink/20'}`}><I size={15} />{l}</button>)}</div>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> Payment received now</label>
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 pt-3"><span className="text-sm text-ink/60">Subtotal (tax added at checkout)</span><span className="font-display text-xl font-extrabold">{money(subtotal)}</span></div>
        <button className="btn-primary w-full py-3" disabled={!cart.length || busy} onClick={place}>{busy ? 'Sending' : 'Place order and bill'}</button>
      </aside>

      <Modal open={!!done} onClose={() => setDone(null)} title="Order placed" footer={<><button className="btn-outline" onClick={() => setDone(null)}>New order</button><button className="btn-primary" onClick={() => { if (!printBill()) toast.error('Printer is offline or unavailable. Check the connection and try again.'); }}><Printer size={15} />Print bill</button></>}>
        {done && <><p className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest"><CheckCircle2 size={16} /> Payment {done.order.paymentStatus === 'paid' ? `recorded in the ledger (${label(done.order.paymentMethod)})` : 'pending'}.</p><Receipt order={done.order} restaurant={done.restaurant} /></>}
      </Modal>
    </div>
  );
}

function Ledger() {
  const { branch } = useBranch();
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/payments', { params: { branch, method: method || undefined, from: from || undefined, to: to || undefined } })).data, [branch, method, from, to]);
  const [pending, setPending] = useState(null);
  const { data: unpaid, reload: reloadUnpaid } = useLoad(async () => (await api.get('/manage/orders', { params: { branch, limit: 200 } })).data.filter((o) => o.paymentStatus === 'pending' && !['rejected', 'cancelled'].includes(o.status)), [branch]);
  const pay = async (o, m) => { try { await api.post(`/manage/orders/${o._id}/pay`, { method: m }); toast.success('Payment recorded'); reload(); reloadUnpaid(); setPending(null); } catch (e) { toast.error(errMsg(e)); } };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Cash', data.totals.cash], ['Card', data.totals.card], ['Online', data.totals.online], ['Refunded', data.refunded]].map(([l, v]) => <div key={l} className="card p-4"><p className="text-xs font-semibold text-ink/60">{l}</p><p className="font-display text-2xl font-extrabold">{money(v)}</p></div>)}
      </div>
      {unpaid?.length > 0 && (
        <section className="card mb-5 p-4"><h2 className="mb-3 font-bold">Waiting for payment ({unpaid.length})</h2>
          <ul className="divide-y divide-ink/5">{unpaid.slice(0, 8).map((o) => <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><b>{o.orderNo}</b> · {o.customerName} · {money(o.total)}</span>
            <span className="flex gap-1">{PAY.map(([v, l]) => <button key={v} className="btn-outline btn-sm" onClick={() => pay(o, v)}>Paid by {l.toLowerCase()}</button>)}</span></li>)}</ul></section>
      )}
      <div className="mb-3 flex flex-wrap gap-3">
        <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method"><option value="">All methods</option><option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option></select>
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
      </div>
      {!data.rows.length ? <Empty title="No payments in this range" /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Time', 'Order', 'Branch', 'Method', 'Amount', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.rows.map((r) => <tr key={r._id}><td className="td whitespace-nowrap text-ink/60">{fmtDateTime(r.paidAt)}</td><td className="td font-semibold">{r.orderNo}</td><td className="td">{r.branch?.name}</td><td className="td">{label(r.method)}</td><td className="td">{money(r.amount)}</td><td className="td"><Badge className={r.status === 'paid' ? 'bg-forest-light text-forest' : 'bg-chili-light text-chili'}>{label(r.status)}</Badge></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}

export default function POS() {
  const [tab, setTab] = useState('terminal');
  return (
    <>
      <PageHeader title="POS and payments" sub="Take walk-in orders, print bills and keep the payment ledger accurate." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'terminal', label: 'POS terminal' }, { id: 'ledger', label: 'Payment ledger' }]} />
      {tab === 'terminal' ? <Terminal /> : <Ledger />}
    </>
  );
}
