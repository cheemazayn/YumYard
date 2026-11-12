import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, Modal, Field, Empty, Badge, confirmAction } from '../../components/ui';

export default function Team() {
  const { branches } = useBranch();
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/team')).data, []);
  const [m, setM] = useState(null);
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });
  const save = async () => { try { await api.post('/manage/team', m); toast.success('Team member added'); setM(null); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (u) => { if (!confirmAction(`Remove ${u.name}?`)) return; await api.delete(`/manage/team/${u._id}`); reload(); };
  return (
    <>
      <PageHeader title="Team" sub="Managers see every branch. Staff are limited to one branch and cannot change prices or settings." actions={<button className="btn-primary" onClick={() => setM({ name: '', email: '', password: '', role: 'staff', branch: branches[0]?._id })}><Plus size={15} />Add team member</button>} />
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data.length ? <Empty icon={Users} title="Just you so far" hint="Add managers and branch staff so they can take orders and update stock." /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Name', 'Email', 'Role', 'Branch', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{data.map((u) => <tr key={u._id}><td className="td font-semibold">{u.name}</td><td className="td text-ink/60">{u.email}</td><td className="td"><Badge className={u.role === 'manager' ? 'bg-forest-light text-forest' : 'bg-mist text-ink/70'}>{u.role}</Badge></td><td className="td">{u.branch?.name || 'All branches'}</td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => del(u)} aria-label="Remove"><Trash2 size={14} className="text-chili" /></button></td></tr>)}</tbody></table></div>
      )}
      <Modal open={!!m} onClose={() => setM(null)} title="Add team member" footer={<><button className="btn-outline" onClick={() => setM(null)}>Cancel</button><button className="btn-primary" onClick={save}>Add</button></>}>
        {m && <div className="grid gap-3 sm:grid-cols-2"><Field label="Full name" className="sm:col-span-2"><input className="input" value={m.name} onChange={set('name')} /></Field><Field label="Email"><input className="input" type="email" value={m.email} onChange={set('email')} /></Field>
          <Field label="Temporary password" hint="8+ characters, letter and number"><input className="input" type="text" value={m.password} onChange={set('password')} /></Field>
          <Field label="Role"><select className="input" value={m.role} onChange={set('role')}><option value="staff">Staff (one branch)</option><option value="manager">Manager (all branches)</option></select></Field>
          {m.role === 'staff' && <Field label="Branch"><select className="input" value={m.branch} onChange={set('branch')}>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>}</div>}
      </Modal>
    </>
  );
}
