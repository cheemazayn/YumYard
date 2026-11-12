import { useState } from 'react';
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, fmtDate, money } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, Modal, Field, Empty, Badge, Toggle, confirmAction } from '../../components/ui';

const blank = { code: '', description: '', type: 'percent', value: '', minOrder: '', usageLimit: '', startsAt: '', expiresAt: '', branch: '', active: true };
const d10 = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function Promotions() {
  const { branches } = useBranch();
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/coupons')).data, []);
  const [m, setM] = useState(null);
  const status = (c) => {
    const now = new Date();
    if (!c.active) return ['Paused', 'bg-mist text-ink/60'];
    if (c.expiresAt && new Date(c.expiresAt) < now) return ['Expired', 'bg-chili-light text-chili'];
    if (c.startsAt && new Date(c.startsAt) > now) return ['Scheduled', 'bg-blue-50 text-blue-700'];
    if (c.usageLimit && c.usedCount >= c.usageLimit) return ['Used up', 'bg-saffron-light text-saffron-dark'];
    return ['Live', 'bg-forest-light text-forest'];
  };
  const save = async () => {
    try { m._id ? await api.put(`/manage/coupons/${m._id}`, m) : await api.post('/manage/coupons', m); toast.success('Coupon saved'); setM(null); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (c) => { if (!confirmAction(`Delete ${c.code}?`)) return; await api.delete(`/manage/coupons/${c._id}`); reload(); };
  const toggle = async (c) => { try { await api.put(`/manage/coupons/${c._id}`, { ...c, branch: c.branch?._id, active: !c.active }); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Promotions" sub="Seasonal coupons with start and end dates and usage limits. Guests enter the code at checkout." actions={<button className="btn-primary" onClick={() => setM(blank)}><Plus size={15} />New coupon</button>} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data.length ? <Empty icon={Ticket} title="No coupons yet" hint="Create a first one, for example 10% off over Rs 1,000." /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Code', 'Discount', 'Min. order', 'Valid', 'Used', 'Branch', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((c) => { const [s, cls] = status(c); return (
            <tr key={c._id}><td className="td"><p className="font-mono font-bold">{c.code}</p><p className="text-xs text-ink/50">{c.description}</p></td><td className="td font-semibold">{c.type === 'percent' ? `${c.value}%` : money(c.value)}</td><td className="td">{c.minOrder ? money(c.minOrder) : '-'}</td>
              <td className="td whitespace-nowrap text-xs text-ink/60">{c.startsAt ? fmtDate(c.startsAt) : 'Now'} to {c.expiresAt ? fmtDate(c.expiresAt) : 'no end'}</td><td className="td">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td><td className="td text-ink/60">{c.branch?.name || 'All'}</td>
              <td className="td"><Badge className={cls}>{s}</Badge></td>
              <td className="td"><div className="flex items-center justify-end gap-1"><Toggle checked={c.active} onChange={() => toggle(c)} label="" /><button className="btn-ghost btn-sm" onClick={() => setM({ ...c, branch: c.branch?._id || '', startsAt: d10(c.startsAt), expiresAt: d10(c.expiresAt) })} aria-label="Edit"><Pencil size={14} /></button><button className="btn-ghost btn-sm" onClick={() => del(c)} aria-label="Delete"><Trash2 size={14} className="text-chili" /></button></div></td></tr>); })}</tbody></table></div>
      )}
      <Modal open={!!m} onClose={() => setM(null)} wide title={m?._id ? 'Edit coupon' : 'New coupon'} footer={<><button className="btn-outline" onClick={() => setM(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save coupon</button></>}>
        {m && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code"><input className="input font-mono uppercase" value={m.code} onChange={set('code')} placeholder="EID20" /></Field>
          <Field label="Description"><input className="input" value={m.description || ''} onChange={set('description')} /></Field>
          <Field label="Discount type"><select className="input" value={m.type} onChange={set('type')}><option value="percent">Percentage</option><option value="flat">Flat amount (Rs)</option></select></Field>
          <Field label={m.type === 'percent' ? 'Percent off' : 'Rupees off'}><input className="input" type="number" min="0" value={m.value} onChange={set('value')} /></Field>
          <Field label="Minimum order (Rs)"><input className="input" type="number" min="0" value={m.minOrder} onChange={set('minOrder')} /></Field>
          <Field label="Usage limit" hint="0 or empty means unlimited."><input className="input" type="number" min="0" value={m.usageLimit} onChange={set('usageLimit')} /></Field>
          <Field label="Starts on"><input className="input" type="date" value={m.startsAt} onChange={set('startsAt')} /></Field>
          <Field label="Ends on"><input className="input" type="date" value={m.expiresAt} onChange={set('expiresAt')} /></Field>
          {branches.length > 1 && <Field label="Valid at" className="sm:col-span-2"><select className="input" value={m.branch} onChange={set('branch')}><option value="">All branches</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>}
        </div>}
      </Modal>
    </>
  );
}
