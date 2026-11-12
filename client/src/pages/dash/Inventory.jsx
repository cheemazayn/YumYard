import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, PackagePlus, Trash2, SlidersHorizontal, Pencil, Truck, CalendarDays, Download, CheckCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { api, errMsg, money, fmtDate } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useLoad, Loading, ErrorBox, PageHeader, Tabs, Modal, Field, Empty, Badge, StatCard, confirmAction } from '../../components/ui';

const STATUS = { critical: ['Critical', 'bg-chili-light text-chili'], low: ['Low', 'bg-saffron-light text-saffron-dark'], overstock: ['Overstock', 'bg-blue-50 text-blue-700'], ok: ['Healthy', 'bg-forest-light text-forest'] };
const n1 = (v) => Math.round(v * 10) / 10;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Stock() {
  const { user } = useAuth();
  const { branch, branches } = useBranch();
  const lead = ['owner', 'manager'].includes(user.role);
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/inventory', { params: { branch } })).data, [branch]);
  const { data: suppliers } = useLoad(async () => (lead ? (await api.get('/manage/suppliers')).data : []), []);
  const [modal, setModal] = useState(null); // {type, item}
  const [f, setF] = useState({});
  const close = () => setModal(null);
  const open = (type, item = {}) => { setModal({ type, item }); setF(type === 'edit' ? { ...item, supplier: item.supplier?._id || '', branch: item.branch?._id } : type === 'new' ? { name: '', unit: 'kg', quantity: 0, reorderLevel: 5, costPerUnit: 0, perishable: true, supplier: '', branch: branch || branches[0]?._id } : { qty: '', mode: 'set', reason: '' }); };
  const submit = async () => {
    const it = modal.item;
    try {
      if (modal.type === 'restock') await api.post(`/manage/inventory/${it._id}/restock`, { qty: f.qty });
      if (modal.type === 'waste') await api.post(`/manage/inventory/${it._id}/wastage`, { qty: f.qty, reason: f.reason });
      if (modal.type === 'adjust') await api.post(`/manage/inventory/${it._id}/adjust`, f);
      if (modal.type === 'edit') await api.put(`/manage/inventory/${it._id}`, { ...f, supplier: f.supplier || null });
      if (modal.type === 'new') await api.post('/manage/inventory', { ...f, supplier: f.supplier || undefined });
      toast.success('Saved'); close(); reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (it) => { if (!confirmAction(`Remove ${it.name} from inventory?`)) return; try { await api.delete(`/manage/inventory/${it._id}`); reload(); } catch (e) { toast.error(errMsg(e)); } };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const low = data.filter((i) => i.quantity <= i.reorderLevel);
  return (
    <>
      {low.length > 0 && <div className="mb-4 rounded-lg border border-chili/30 bg-chili-light p-4 text-sm text-chili"><b>{low.length} item{low.length > 1 ? 's are' : ' is'} at or below the minimum level:</b> {low.slice(0, 6).map((i) => `${i.name} (${i.branch?.name})`).join(', ')}.</div>}
      <div className="mb-4 flex justify-end">{lead && <button className="btn-primary" onClick={() => open('new')}><Plus size={15} />Add item</button>}</div>
      {!data.length ? <Empty title="No inventory yet" hint="Add ingredients, then list them in each dish's recipe so stock is deducted automatically." /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Item', 'Branch', 'In stock', 'Minimum', 'Supplier', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((i) => { const bad = i.quantity <= i.reorderLevel; return (
            <tr key={i._id}><td className="td font-semibold">{i.name}</td><td className="td text-ink/60">{i.branch?.name}</td>
              <td className={`td font-semibold ${bad ? 'text-chili' : ''}`}>{n1(i.quantity)} {i.unit}</td><td className="td text-ink/60">{i.reorderLevel} {i.unit}</td><td className="td text-ink/60">{i.supplier?.name || '-'}</td>
              <td className="td">{bad ? <Badge className={STATUS.critical[1]}>Reorder</Badge> : <Badge className={STATUS.ok[1]}>OK</Badge>}</td>
              <td className="td"><div className="flex justify-end gap-0.5">
                <button className="btn-ghost btn-sm" title="Add stock" onClick={() => open('restock', i)}><PackagePlus size={15} /></button>
                <button className="btn-ghost btn-sm" title="Log wastage" onClick={() => open('waste', i)}><Trash2 size={15} /></button>
                <button className="btn-ghost btn-sm" title="Adjust after audit" onClick={() => open('adjust', i)}><SlidersHorizontal size={15} /></button>
                {lead && <button className="btn-ghost btn-sm" title="Edit" onClick={() => open('edit', i)}><Pencil size={15} /></button>}
                {lead && <button className="btn-ghost btn-sm" title="Delete" onClick={() => del(i)}><Trash2 size={15} className="text-chili" /></button>}</div></td></tr>); })}</tbody></table></div>
      )}
      <Modal open={!!modal} onClose={close} title={modal ? { restock: `Add stock: ${modal.item.name}`, waste: `Log wastage: ${modal.item.name}`, adjust: `Adjust after audit: ${modal.item.name}`, edit: `Edit ${modal.item.name}`, new: 'Add inventory item' }[modal.type] : ''} footer={<><button className="btn-outline" onClick={close}>Cancel</button><button className="btn-primary" onClick={submit}>Save</button></>}>
        {(modal?.type === 'restock' || modal?.type === 'waste') && <div className="space-y-3"><Field label={`Quantity (${modal.item.unit})`}><input className="input" type="number" min="0" step="0.1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} autoFocus /></Field>{modal.type === 'waste' && <Field label="Reason"><select className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}><option value="">Spoiled</option><option>Expired</option><option>Dropped or damaged</option><option>Over-prepared</option></select></Field>}</div>}
        {modal?.type === 'adjust' && <div className="space-y-3"><p className="text-sm text-ink/60">Current count: <b>{n1(modal.item.quantity)} {modal.item.unit}</b>. Use this after a physical stock check.</p>
          <Field label="What do you want to do?"><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="set">Set the exact count</option><option value="add">Add to the count</option><option value="deduct">Deduct from the count</option></select></Field>
          <Field label={`Quantity (${modal.item.unit})`}><input className="input" type="number" min="0" step="0.1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Reason"><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Physical audit" /></Field></div>}
        {(modal?.type === 'edit' || modal?.type === 'new') && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            {modal.type === 'new' && branches.length > 1 && <Field label="Branch" className="sm:col-span-2"><select className="input" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>}
            <Field label="Unit"><select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{['kg', 'g', 'l', 'ml', 'pcs', 'dozen'].map((u) => <option key={u}>{u}</option>)}</select></Field>
            <Field label="Quantity in stock"><input className="input" type="number" min="0" step="0.1" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
            <Field label="Minimum level (alert threshold)"><input className="input" type="number" min="0" step="0.1" value={f.reorderLevel} onChange={(e) => setF({ ...f, reorderLevel: e.target.value })} /></Field>
            <Field label="Cost per unit (Rs)"><input className="input" type="number" min="0" value={f.costPerUnit} onChange={(e) => setF({ ...f, costPerUnit: e.target.value })} /></Field>
            <Field label="Supplier"><select className="input" value={f.supplier || ''} onChange={(e) => setF({ ...f, supplier: e.target.value })}><option value="">None</option>{(suppliers || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={!!f.perishable} onChange={(e) => setF({ ...f, perishable: e.target.checked })} /> Perishable (spoils quickly)</label>
          </div>
        )}
      </Modal>
    </>
  );
}

function Forecast() {
  const { branch } = useBranch();
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/ai/forecast', { params: { branch } })).data, [branch]);
  const { data: suppliers, reload: reloadSup } = useLoad(async () => (await api.get('/manage/suppliers')).data, []);
  const [busy, setBusy] = useState('');
  if (loading && !data) return <Loading text="Analysing consumption" />;
  if (error) return <ErrorBox message={error} retry={reload} />;

  const groups = Object.values((data.purchaseList || []).reduce((m, p) => { const k = `${p.supplierId || 'none'}`; (m[k] ||= { id: p.supplierId, name: p.supplier, items: [] }).items.push(p); return m; }, {}));
  const logOrder = async (g) => {
    setBusy(g.name);
    try {
      const byBranch = g.items.reduce((m, i) => { (m[i.branchId] ||= []).push(i); return m; }, {});
      for (const [b, list] of Object.entries(byBranch)) await api.post(`/manage/suppliers/${g.id}/orders`, { branch: b, items: list.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, cost: i.cost })), note: 'From the AI purchase list' });
      toast.success(`Order logged with ${g.name}`); reloadSup();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy('');
  };
  const csv = () => {
    const rows = ['Supplier,Item,Branch,Quantity,Unit,Estimated cost', ...data.purchaseList.map((p) => [p.supplier, p.name, p.branch, p.qty, p.unit, p.cost].map((v) => `"${v}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' })); a.download = 'purchase-list.csv'; a.click();
  };
  const next7 = data.totalNext7;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Critical" value={data.summary.critical} tone={data.summary.critical ? 'danger' : undefined} sub="run out within 2 days" />
        <StatCard label="Running low" value={data.summary.low} sub="under 4 days left" />
        <StatCard label="Overstocked" value={data.summary.overstock} sub="risk of spoilage" />
        <StatCard label="Wasted, 30 days" value={money(data.summary.wasteCost30)} />
      </div>
      {data.upcoming.holiday && <p className="mb-4 flex items-center gap-2 rounded-lg bg-saffron-light p-3 text-sm"><CalendarDays size={16} />{data.upcoming.holiday.name} falls on {fmtDate(data.upcoming.holiday.date)}. Forecasts include a holiday uplift.</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5"><h2 className="mb-1 font-bold">Expected usage, next 7 days</h2><p className="mb-3 text-xs text-ink/50">All items combined. Fridays, Saturdays, Sundays and holidays run higher.</p>
          <div className="h-48"><ResponsiveContainer><BarChart data={next7.map((d) => ({ ...d, label: DOW[new Date(d.date).getDay()] }))}><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis width={34} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Units" radius={[3, 3, 0, 0]}>{next7.map((d, i) => <Cell key={i} fill={d.holiday || [5, 6, 0].includes(new Date(d.date).getDay()) ? '#F0A81F' : '#1F4D3A'} />)}</Bar></BarChart></ResponsiveContainer></div></section>
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Suggested purchase list</h2>{data.purchaseList.length > 0 && <button className="btn-outline btn-sm" onClick={csv}><Download size={14} />Download</button>}</div>
          {!groups.length ? <p className="text-sm text-ink/60">Nothing needs ordering this week.</p> : (
            <div className="space-y-4">{groups.map((g) => (
              <div key={g.name} className="rounded-lg border border-ink/10 p-3">
                <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-bold"><Truck size={15} />{g.name}</p>
                  {g.id ? <button className="btn-primary btn-sm" disabled={busy === g.name} onClick={() => logOrder(g)}>{busy === g.name ? 'Logging' : 'Log supply order'}</button> : <span className="text-xs text-ink/50">Assign a supplier to order</span>}</div>
                <ul className="divide-y divide-ink/5 text-sm">{g.items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span>{i.name} <span className="text-ink/50">({i.branch})</span></span><span className="font-semibold">{i.qty} {i.unit} <span className="font-normal text-ink/50">~ {money(i.cost)}</span></span></li>)}</ul></div>))}</div>
          )}
        </section>
      </div>
      <section className="card mt-4 overflow-x-auto"><h2 className="p-5 pb-3 font-bold">Item forecast</h2>
        <table className="w-full"><thead className="border-y border-ink/10 bg-paper"><tr>{['Item', 'Branch', 'Stock', 'Daily use', 'Days left', 'Next 7 days', 'Weekend need', 'Order', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.items.map((i) => (
            <tr key={i._id} title={i.advice}><td className="td font-semibold">{i.name}</td><td className="td text-ink/60">{i.branch}</td><td className="td">{n1(i.quantity)} {i.unit}</td><td className="td">{i.avgDaily}</td><td className="td">{i.daysLeft ?? '-'}</td><td className="td">{i.need7}</td><td className="td">{i.weekendNeed}</td><td className="td font-semibold">{i.reorder > 0 ? `${i.reorder} ${i.unit}` : '-'}</td><td className="td"><Badge className={STATUS[i.status][1]}>{STATUS[i.status][0]}</Badge></td></tr>))}</tbody></table>
        <p className="p-4 text-xs text-ink/50">Forecasts use a weighted moving average of the last 14 days, a trend line, day-of-week patterns and public holidays. Hover a row for advice.</p></section>
    </>
  );
}

function Suppliers() {
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/suppliers')).data, []);
  const [m, setM] = useState(null);
  const [open, setOpen] = useState(null);
  const save = async () => {
    try { const body = { ...m, materials: typeof m.materials === 'string' ? m.materials.split(',').map((x) => x.trim()).filter(Boolean) : m.materials }; m._id ? await api.put(`/manage/suppliers/${m._id}`, body) : await api.post('/manage/suppliers', body); setM(null); reload(); toast.success('Supplier saved'); } catch (e) { toast.error(errMsg(e)); }
  };
  const receive = async (s, o) => { try { await api.patch(`/manage/suppliers/${s._id}/orders/${o._id}/receive`); toast.success('Marked as received and added to stock'); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (s) => { if (!confirmAction(`Delete ${s.name}?`)) return; await api.delete(`/manage/suppliers/${s._id}`); reload(); };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return (
    <>
      <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setM({ name: '', contact: '', phone: '', email: '', materials: '' })}><Plus size={15} />Add supplier</button></div>
      {!data.length ? <Empty title="No suppliers yet" hint="Keep vendor contacts, what they supply and your order history in one place." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <article key={s._id} className="card p-5">
              <div className="flex items-start justify-between"><div><h3 className="font-display text-lg font-bold">{s.name}</h3><p className="text-sm text-ink/60">{s.contact} {s.phone && `· ${s.phone}`}</p>{s.email && <p className="text-sm text-ink/60">{s.email}</p>}</div>
                <div className="flex"><button className="btn-ghost btn-sm" onClick={() => setM({ ...s, materials: s.materials.join(', ') })} aria-label="Edit"><Pencil size={14} /></button><button className="btn-ghost btn-sm" onClick={() => del(s)} aria-label="Delete"><Trash2 size={14} className="text-chili" /></button></div></div>
              <div className="mt-3 flex flex-wrap gap-1">{s.materials.map((x) => <Badge key={x}>{x}</Badge>)}</div>
              <button className="mt-4 text-sm font-semibold text-forest" onClick={() => setOpen(open === s._id ? null : s._id)}>{open === s._id ? 'Hide' : 'Show'} supply history ({s.orders.length})</button>
              {open === s._id && <ul className="mt-2 divide-y divide-ink/5 text-sm">{[...s.orders].reverse().map((o) => (
                <li key={o._id} className="py-2"><div className="flex items-center justify-between"><span className="font-semibold">{fmtDate(o.date)} {o.branch?.name && <span className="font-normal text-ink/50">· {o.branch.name}</span>}</span><span>{money(o.total)}</span></div>
                  <p className="text-xs text-ink/60">{o.items.map((i) => `${i.qty} ${i.unit || ''} ${i.name}`).join(', ')}</p>
                  <div className="mt-1">{o.status === 'received' ? <Badge className="bg-forest-light text-forest">Received</Badge> : <button className="btn-outline btn-sm" onClick={() => receive(s, o)}><CheckCheck size={13} />Mark received</button>}</div></li>))}</ul>}
            </article>
          ))}
        </div>
      )}
      <Modal open={!!m} onClose={() => setM(null)} title={m?._id ? 'Edit supplier' : 'Add supplier'} footer={<><button className="btn-outline" onClick={() => setM(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        {m && <div className="grid gap-3 sm:grid-cols-2"><Field label="Company" className="sm:col-span-2"><input className="input" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} /></Field>
          <Field label="Contact person"><input className="input" value={m.contact || ''} onChange={(e) => setM({ ...m, contact: e.target.value })} /></Field><Field label="Phone"><input className="input" value={m.phone || ''} onChange={(e) => setM({ ...m, phone: e.target.value })} /></Field>
          <Field label="Email" className="sm:col-span-2"><input className="input" type="email" value={m.email || ''} onChange={(e) => setM({ ...m, email: e.target.value })} /></Field>
          <Field label="Materials they supply" hint="Separate with commas" className="sm:col-span-2"><input className="input" value={m.materials} onChange={(e) => setM({ ...m, materials: e.target.value })} /></Field></div>}
      </Modal>
    </>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const [tab, setTab] = useState('stock');
  const lead = ['owner', 'manager'].includes(user.role);
  return (
    <>
      <PageHeader title="Inventory" sub="Stock drops as dishes sell. Forecasts tell you what to buy before you run out." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'stock', label: 'Stock levels' }, ...(lead ? [{ id: 'forecast', label: 'AI forecast and purchase list' }, { id: 'suppliers', label: 'Suppliers' }] : [])]} />
      {tab === 'stock' ? <Stock /> : tab === 'forecast' ? <Forecast /> : <Suppliers />}
    </>
  );
}
