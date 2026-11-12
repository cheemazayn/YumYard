import { useEffect, useMemo, useState } from 'react';
import { Check, X, ChefHat, PackageCheck, Bike, CircleCheck, Printer, Clock, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, getSocket, money, label, STATUS_STYLE, fmtTime, fmtDateTime, statusText } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, Tabs, Empty, Modal, Field, Badge } from '../../components/ui';
import Receipt, { printBill } from '../../components/Receipt';
import { useAuth } from '../../context/AuthContext';

const useTick = () => { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), 15000); return () => clearInterval(t); }, []); return n; };

export function OrderCard({ o, act, onBill, now }) {
  const elapsed = Math.floor((now - new Date(o.createdAt)) / 60000);
  const late = ['pending', 'confirmed', 'in_kitchen'].includes(o.status) && elapsed > o.estimatedMinutes;
  const next = {
    pending: [{ s: 'confirmed', t: 'Accept', i: Check, c: 'btn-primary' }, { s: 'rejected', t: 'Reject', i: X, c: 'btn-outline text-chili' }],
    confirmed: [{ s: 'in_kitchen', t: 'Start cooking', i: ChefHat, c: 'btn-accent' }],
    in_kitchen: [{ s: 'ready', t: o.type === 'delivery' ? 'Packed' : o.type === 'takeaway' ? 'Ready for pickup' : 'Ready to serve', i: PackageCheck, c: 'btn-primary' }],
    ready: o.type === 'delivery' ? [{ s: 'out_for_delivery', t: 'Out for delivery', i: Bike, c: 'btn-primary' }] : [{ s: 'delivered', t: o.type === 'takeaway' ? 'Picked up' : 'Served', i: CircleCheck, c: 'btn-primary' }],
    out_for_delivery: [{ s: 'delivered', t: 'Delivered', i: CircleCheck, c: 'btn-primary' }],
  }[o.status] || [];
  return (
    <article className={`card p-4 ${o.status === 'pending' ? 'border-saffron ring-1 ring-saffron/40' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-display text-base font-extrabold">{o.orderNo}</p><p className="text-xs text-ink/60">{o.branch?.name} · {label(o.type)}{o.tableNo ? ` · Table ${o.tableNo}` : ''} · {o.source === 'pos' ? 'POS' : 'Website'}</p></div>
        <Badge className={STATUS_STYLE[o.status]}>{statusText(o.status, o.type)}</Badge>
      </div>
      <ul className="mt-3 space-y-0.5 text-sm">{o.items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty} x {i.name}</span></li>)}</ul>
      {o.note && <p className="mt-2 rounded bg-saffron-light px-2 py-1 text-xs"><b>Note:</b> {o.note}</p>}
      <div className="mt-3 space-y-1 text-xs text-ink/60">
        <p className="flex items-center gap-1.5"><Phone size={12} />{o.customerName} {o.phone && `· ${o.phone}`}</p>
        {o.type === 'delivery' && o.address && <p className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0" />{o.address}</p>}
        <p className={`flex items-center gap-1.5 ${late ? 'font-semibold text-chili' : ''}`}><Clock size={12} />{fmtTime(o.createdAt)} · {elapsed} min ago · target {o.estimatedMinutes} min{late ? ' (late)' : ''}</p>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
        <div><p className="font-display font-extrabold">{money(o.total)}</p><p className="text-xs text-ink/50">{label(o.paymentMethod)} · {label(o.paymentStatus)}</p></div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <button className="btn-ghost btn-sm" onClick={() => onBill(o)} aria-label="Print bill"><Printer size={14} /></button>
          {next.map((n) => <button key={n.s} className={`btn btn-sm ${n.c}`} onClick={() => act(o, n.s)}><n.i size={14} />{n.t}</button>)}
        </div>
      </div>
    </article>
  );
}

export function useBill() {
  const [bill, setBill] = useState(null);
  const open = async (o) => { try { const { data } = await api.get(`/manage/orders/${o._id}`); setBill(data); } catch (e) { toast.error(errMsg(e)); } };
  const modal = (
    <Modal open={!!bill} onClose={() => setBill(null)} title="Bill" footer={<><button className="btn-outline" onClick={() => setBill(null)}>Close</button><button className="btn-primary" onClick={() => { if (!printBill()) toast.error('Printer is offline or unavailable. Check the connection and try again.'); }}><Printer size={15} />Print bill</button></>}>
      {bill && <Receipt order={bill.order} restaurant={bill.restaurant} />}
    </Modal>
  );
  return { open, modal };
}

export default function Orders() {
  const { branch } = useBranch();
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const now = useTick();
  const { data, setData, loading, error, reload } = useLoad(async () => (await api.get('/manage/orders', { params: { branch, status: tab === 'active' ? 'active' : undefined, limit: tab === 'active' ? 200 : 100 } })).data, [branch, tab]);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const bill = useBill();

  useEffect(() => {
    const s = getSocket();
    const r = () => reload();
    s.on('order:new', r); s.on('order:update', r);
    const t = setInterval(reload, 30000);
    return () => { s.off('order:new', r); s.off('order:update', r); clearInterval(t); };
  // eslint-disable-next-line
  }, [branch, tab]);

  const act = async (o, status, why) => {
    if (status === 'rejected' && why === undefined) { setReject(o); setReason(''); return; }
    try {
      await api.patch(`/manage/orders/${o._id}/status`, { status, reason: why });
      toast.success(status === 'rejected' ? 'Order rejected. Any card payment is refunded.' : `${o.orderNo} moved to ${label(status)}`);
      setReject(null); reload();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const cols = useMemo(() => {
    const l = data || [];
    return [
      ['New orders', l.filter((o) => o.status === 'pending').reverse()],
      ['In the kitchen', l.filter((o) => ['confirmed', 'in_kitchen'].includes(o.status)).reverse()],
      ['Ready and on the way', l.filter((o) => ['ready', 'out_for_delivery'].includes(o.status)).reverse()],
    ];
  }, [data]);

  return (
    <>
      <PageHeader title="Orders" sub="New orders arrive here instantly with a sound alert. Accept, cook and hand over." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'active', label: 'Live queue' }, { id: 'history', label: 'History' }]} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : tab === 'active' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {cols.map(([title, list]) => (
            <section key={title}><h2 className="mb-3 flex items-center gap-2 text-sm font-bold">{title}<span className="rounded bg-ink/10 px-1.5 text-xs">{list.length}</span></h2>
              <div className="space-y-3">{list.length ? list.map((o) => <OrderCard key={o._id} o={o} act={act} onBill={bill.open} now={now} />) : <p className="rounded-lg border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">Nothing here</p>}</div></section>
          ))}
        </div>
      ) : !data.length ? <Empty title="No orders yet" /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Order', 'When', 'Branch', 'Type', 'Items', 'Total', 'Payment', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((o) => (
            <tr key={o._id}><td className="td font-semibold">{o.orderNo}</td><td className="td whitespace-nowrap text-ink/60">{fmtDateTime(o.createdAt)}</td><td className="td">{o.branch?.name}</td><td className="td">{label(o.type)}</td>
              <td className="td max-w-[220px] truncate text-ink/60">{o.items.map((i) => `${i.qty} ${i.name}`).join(', ')}</td><td className="td">{money(o.total)}</td><td className="td text-xs">{label(o.paymentMethod)}<br /><span className="text-ink/50">{label(o.paymentStatus)}</span></td>
              <td className="td"><Badge className={STATUS_STYLE[o.status]}>{statusText(o.status, o.type)}</Badge></td><td className="td"><button className="btn-ghost btn-sm" onClick={() => bill.open(o)} aria-label="Print bill"><Printer size={14} /></button></td></tr>))}</tbody></table></div>
      )}
      <Modal open={!!reject} onClose={() => setReject(null)} title={`Reject ${reject?.orderNo}`} footer={<><button className="btn-outline" onClick={() => setReject(null)}>Back</button><button className="btn-danger" disabled={!reason.trim()} onClick={() => act(reject, 'rejected', reason)}>Reject order</button></>}>
        <Field label="Reason shown to the customer"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: we ran out of an ingredient" /></Field>
        {reject?.paymentStatus === 'paid' && <p className="mt-3 text-sm text-ink/60">The customer paid by {reject.paymentMethod}. The payment will be refunded automatically.</p>}
      </Modal>
      {bill.modal}
    </>
  );
}
