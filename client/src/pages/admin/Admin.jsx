import { useState } from 'react';
import { FileText, Check, X, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money, fmtDate, fmtDateTime, label } from '../../lib/api';
import { useLoad, Loading, ErrorBox, PageHeader, StatCard, Modal, Field, Empty, Badge, Toggle, Tabs, confirmAction } from '../../components/ui';
import { Security } from '../dash/Settings';

const PLAN = { trial: 'bg-saffron-light text-saffron-dark', active: 'bg-forest-light text-forest', expired: 'bg-chili-light text-chili' };
const RSTATUS = { active: 'bg-forest-light text-forest', pending: 'bg-saffron-light text-saffron-dark', rejected: 'bg-chili-light text-chili' };

export function AdminOverview() {
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/admin/overview')).data, []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const t = data.totals;
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Live restaurants" value={t.restaurants} /><StatCard label="Awaiting approval" value={t.pending} tone={t.pending ? 'danger' : undefined} /><StatCard label="Subscribed" value={t.subscribed} /><StatCard label="On trial" value={t.trial} /><StatCard label="Customers" value={data.customers} /><StatCard label="Orders processed" value={t.orders} sub={money(t.revenue)} />
      </div>
      <section className="card mt-6 overflow-x-auto"><h2 className="p-5 pb-3 font-bold">All restaurants</h2>
        <table className="w-full"><thead className="border-y border-ink/10 bg-paper"><tr>{['Restaurant', 'Owner', 'Branches', 'Orders', 'Revenue', 'Application', 'Plan'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.restaurants.map((r) => <tr key={r._id}><td className="td font-semibold">{r.name}</td><td className="td text-ink/60">{r.owner?.name}</td><td className="td">{r.branches}</td><td className="td">{r.orders}</td><td className="td">{money(r.revenue)}</td><td className="td"><Badge className={RSTATUS[r.status]}>{label(r.status)}</Badge></td><td className="td"><Badge className={PLAN[r.plan.status]}>{label(r.plan.status)}</Badge></td></tr>)}</tbody></table></section>
    </>
  );
}

export function Approvals() {
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/admin/approvals', { params: { status } })).data, [status]);
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState('');
  const decide = async (r, decision, why) => {
    try { await api.post(`/admin/restaurants/${r._id}/decision`, { decision, reason: why }); toast.success(decision === 'approve' ? `${r.name} approved. Their trial has started.` : `${r.name} rejected`); setRej(null); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title="Restaurant approvals" sub="Review each application and its business documents before a restaurant goes live." />
      <Tabs value={status} onChange={setStatus} tabs={[{ id: 'pending', label: 'Pending' }, { id: 'active', label: 'Approved' }, { id: 'rejected', label: 'Rejected' }]} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data.length ? <Empty title={`No ${status} applications`} /> : (
        <div className="grid gap-4 lg:grid-cols-2">{data.map((r) => (
          <article key={r._id} className="card p-5">
            <div className="flex items-start justify-between"><div><h2 className="font-display text-lg font-bold">{r.name}</h2><p className="text-sm text-ink/60">{r.cuisine} · applied {fmtDate(r.createdAt)}</p></div><Badge className={RSTATUS[r.status]}>{label(r.status)}</Badge></div>
            <div className="mt-3 text-sm"><p><b>{r.owner?.name}</b> · {r.owner?.email}</p>{r.owner?.phone && <p className="text-ink/60">{r.owner.phone}</p>}</div>
            <div className="mt-4"><p className="mb-1.5 text-xs font-semibold text-ink/60">Business documents</p>
              {r.documents?.length ? <ul className="space-y-1">{r.documents.map((d, i) => <li key={i}><a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-forest hover:underline"><FileText size={14} />{d.name}</a></li>)}</ul> : <p className="text-sm text-chili">No documents attached.</p>}</div>
            {r.rejectionReason && <p className="mt-3 rounded bg-chili-light p-2 text-sm text-chili">{r.rejectionReason}</p>}
            {r.status !== 'active' && <div className="mt-4 flex gap-2"><button className="btn-primary btn-sm" onClick={() => decide(r, 'approve')}><Check size={14} />Approve</button>{r.status === 'pending' && <button className="btn-outline btn-sm text-chili" onClick={() => { setRej(r); setReason(''); }}><X size={14} />Reject or request more</button>}</div>}
          </article>))}</div>
      )}
      <Modal open={!!rej} onClose={() => setRej(null)} title={`Reject ${rej?.name}`} footer={<><button className="btn-outline" onClick={() => setRej(null)}>Back</button><button className="btn-danger" disabled={!reason.trim()} onClick={() => decide(rej, 'reject', reason)}>Send decision</button></>}>
        <Field label="Message to the owner" hint="Explain the problem, or what extra information or documents you need."><textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

export function Users() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/admin/users', { params: { search: q || undefined, role: role || undefined, status: status || undefined } })).data, [q, role, status]);
  const setS = async (u, s) => {
    if (s !== 'active' && !confirmAction(`${s === 'blocked' ? 'Permanently block' : 'Suspend'} ${u.name}? They will be signed out immediately.`)) return;
    try { await api.patch(`/admin/users/${u._id}/status`, { status: s }); toast.success(`${u.name} is now ${s}`); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const ST = { active: 'bg-forest-light text-forest', suspended: 'bg-saffron-light text-saffron-dark', blocked: 'bg-chili-light text-chili', pending: 'bg-mist' };
  return (
    <>
      <PageHeader title="Users" sub="Every customer, owner, manager and staff account on the platform." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-3 text-ink/40" /><input className="input pl-9" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">All roles</option>{['customer', 'owner', 'manager', 'staff', 'admin'].map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option>{['active', 'suspended', 'blocked'].map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data.length ? <Empty title="User not found" hint="No account matches that search." /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Name', 'Email', 'Role', 'Restaurant', 'Joined', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((u) => <tr key={u._id}><td className="td font-semibold">{u.name}</td><td className="td text-ink/60">{u.email}</td><td className="td">{label(u.role)}</td><td className="td text-ink/60">{u.restaurant?.name || '-'}</td><td className="td whitespace-nowrap text-ink/60">{fmtDate(u.createdAt)}</td><td className="td"><Badge className={ST[u.status]}>{label(u.status)}</Badge></td>
            <td className="td"><div className="flex justify-end gap-1">{u.role !== 'admin' && (u.status === 'active' ? <><button className="btn-outline btn-sm" onClick={() => setS(u, 'suspended')}>Suspend</button><button className="btn-outline btn-sm text-chili" onClick={() => setS(u, 'blocked')}>Block</button></> : <button className="btn-primary btn-sm" onClick={() => setS(u, 'active')}>Restore</button>)}</div></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}

export function Restaurants() {
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/admin/overview')).data.restaurants.filter((r) => r.status === 'active'), []);
  const patch = async (r, body, msg) => { try { await api.patch(`/admin/restaurants/${r._id}`, body); toast.success(msg); reload(); } catch (e) { toast.error(errMsg(e)); } };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return (
    <>
      <PageHeader title="Restaurants" sub="Manage subscriptions and visibility for approved restaurants." />
      {!data.length ? <Empty title="No approved restaurants yet" /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Restaurant', 'Plan', 'Trial ends', 'Visible', 'Actions'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((r) => <tr key={r._id}><td className="td"><p className="font-semibold">{r.name}</p><p className="text-xs text-ink/50">/r/{r.slug}</p></td><td className="td"><Badge className={PLAN[r.plan.status]}>{label(r.plan.status)}</Badge></td><td className="td text-ink/60">{r.plan.status === 'trial' ? fmtDate(r.plan.trialEndsAt) : '-'}</td>
            <td className="td"><Toggle checked={r.isPublished} onChange={(v) => patch(r, { published: v }, v ? 'Restaurant is visible' : 'Restaurant hidden')} label="" /></td>
            <td className="td"><div className="flex flex-wrap gap-1"><button className="btn-outline btn-sm" onClick={() => patch(r, { planStatus: 'active' }, 'Subscription activated')}>Activate</button><button className="btn-outline btn-sm" onClick={() => patch(r, { planStatus: 'trial' }, 'Trial restarted')}>Restart trial</button><button className="btn-outline btn-sm text-chili" onClick={() => patch(r, { planStatus: 'expired' }, 'Plan expired')}>Expire</button></div></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}

export function System() {
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/admin/settings')).data, []);
  const [f, setF] = useState(null);
  const [tab, setTab] = useState('fees');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const cur = f || data;
  const set = (k, v) => setF({ ...cur, [k]: v });
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/admin/settings', cur); toast.success('Settings applied across all restaurants'); setF(null); reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <>
      <PageHeader title="System controls" sub="Platform-wide settings that apply to every restaurant." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'fees', label: 'Fees and sign-in rules' }, { id: 'account', label: 'My security' }]} />
      {tab === 'fees' ? (
        <form onSubmit={save} className="card max-w-xl space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Tax rate (%)" hint="Added to every order."><input className="input" type="number" min="0" max="100" step="0.1" value={cur.taxRate} onChange={(e) => set('taxRate', e.target.value)} /></Field>
            <Field label="Service fee (%)" hint="Added to every order."><input className="input" type="number" min="0" max="100" step="0.1" value={cur.serviceFee} onChange={(e) => set('serviceFee', e.target.value)} /></Field></div>
          <div className="space-y-3 border-t border-ink/10 pt-4"><h2 className="font-bold">Authentication protocols</h2>
            <Toggle checked={cur.requireEmailVerification} onChange={(v) => set('requireEmailVerification', v)} label="Customers must verify their email with a one-time code" />
            <Toggle checked={cur.requireOwner2FA} onChange={(v) => set('requireOwner2FA', v)} label="Restaurant owners must use two-factor authentication" /></div>
          <button className="btn-primary">Apply to all restaurants</button>
        </form>
      ) : <Security />}
    </>
  );
}

export function Logs() {
  const [f, setF] = useState({ action: '', user: '', from: '', to: '' });
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/admin/logs', { params })).data, [f.action, f.user, f.from, f.to]);
  const exportCsv = async () => {
    try {
      const { data: csv } = await api.get('/admin/logs/export', { params, responseType: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(csv); a.download = 'yumyard-activity-logs.csv'; a.click(); toast.success('Logs exported');
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title="Activity logs" sub="A record of approvals, suspensions, settings changes and sign-ins." actions={<button className="btn-primary" onClick={exportCsv}><Download size={15} />Export CSV</button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <input className="input" placeholder="Filter by action" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} /><input className="input" placeholder="Filter by user" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
        <input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From" /><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To" />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data.length ? <Empty title="No activity found" /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Time', 'User', 'Role', 'Action', 'Target', 'IP'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((l) => <tr key={l._id}><td className="td whitespace-nowrap text-ink/60">{fmtDateTime(l.createdAt)}</td><td className="td font-semibold">{l.userName}</td><td className="td">{l.role}</td><td className="td">{l.action}</td><td className="td text-ink/60">{l.target}</td><td className="td font-mono text-xs text-ink/50">{l.ip}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
