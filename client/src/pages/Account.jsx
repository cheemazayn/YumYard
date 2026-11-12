import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Award, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money, label, STATUS_STYLE, fmtDateTime } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLoad, Loading, Empty, Field, Tabs, Modal } from '../components/ui';
import Navbar from '../components/Navbar';

export default function Account() {
  const { user, setUser, signOut } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('orders');
  const { data: orders, loading } = useLoad(async () => (await api.get('/public/my-orders')).data, []);
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', addresses: user.addresses?.length ? user.addresses : [] });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [del, setDel] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    try { const { data } = await api.put('/auth/me', f); setUser(data.user); toast.success('Profile updated'); } catch (err) { toast.error(errMsg(err)); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { await api.post('/auth/change-password', pw); setPw({ current: '', next: '' }); toast.success('Password changed'); } catch (err) { toast.error(errMsg(err)); }
  };
  const remove = async () => {
    try { await api.delete('/auth/me', { data: { confirm: true } }); toast.success('Your account was deleted'); await signOut(); nav('/'); } catch (err) { toast.error(errMsg(err)); }
  };
  const setAddr = (i, k, v) => setF({ ...f, addresses: f.addresses.map((a, j) => (j === i ? { ...a, [k]: v } : a)) });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-28">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-extrabold">Hello, {user.name.split(' ')[0]}</h1><p className="text-sm text-ink/60">{user.email}</p></div>
          <div className="card flex items-center gap-3 px-4 py-2"><Trophy className="text-saffron-dark" size={20} /><div><p className="font-display text-xl font-extrabold leading-none">{user.points}</p><p className="text-xs text-ink/60">game points</p></div></div>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'orders', label: 'Orders' }, { id: 'profile', label: 'Profile and addresses' }, { id: 'security', label: 'Security' }]} />

        {tab === 'orders' && (loading ? <Loading /> : !orders?.length ? <Empty title="No orders yet" hint="When you place an order it will show up here." action={<Link to="/restaurants" className="btn-primary">Find something to eat</Link>} /> : (
          <ul className="space-y-3">{orders.map((o) => (
            <li key={o._id}><Link to={`/track/${o._id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow-lift">
              <div><p className="font-bold">{o.restaurant?.name}</p><p className="text-sm text-ink/60">{o.items.map((i) => `${i.qty} x ${i.name}`).join(', ')}</p><p className="mt-1 text-xs text-ink/50">{o.orderNo} · {fmtDateTime(o.createdAt)}</p></div>
              <div className="text-right"><p className="font-display text-lg font-extrabold">{money(o.total)}</p><span className={`badge ${STATUS_STYLE[o.status]}`}>{label(o.status)}</span></div>
            </Link></li>))}</ul>
        ))}

        {tab === 'profile' && (
          <form onSubmit={save} className="card max-w-xl space-y-4 p-6">
            <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
            <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 300 1234567" /></Field>
            <div>
              <span className="label">Delivery addresses</span>
              <div className="space-y-2">
                {f.addresses.map((a, i) => (
                  <div key={i} className="flex gap-2"><input className="input w-24" value={a.label} onChange={(e) => setAddr(i, 'label', e.target.value)} aria-label="Label" /><input className="input flex-1" value={a.line} onChange={(e) => setAddr(i, 'line', e.target.value)} placeholder="House, street, area" aria-label="Address" />
                    <button type="button" className="btn-ghost px-2" onClick={() => setF({ ...f, addresses: f.addresses.filter((_, j) => j !== i) })} aria-label="Remove address"><Trash2 size={16} className="text-chili" /></button></div>
                ))}
              </div>
              <button type="button" className="btn-outline btn-sm mt-2" onClick={() => setF({ ...f, addresses: [...f.addresses, { label: 'Home', line: '' }] })}><Plus size={14} /> Add address</button>
            </div>
            <button className="btn-primary">Save changes</button>
          </form>
        )}

        {tab === 'security' && (
          <div className="max-w-xl space-y-6">
            <form onSubmit={changePw} className="card space-y-4 p-6">
              <h2 className="text-lg font-bold">Change password</h2>
              <Field label="Current password"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
              <Field label="New password" hint="At least 8 characters with a letter and a number."><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
              <button className="btn-primary">Update password</button>
            </form>
            <div className="card border-chili/30 p-6">
              <h2 className="text-lg font-bold text-chili">Delete account</h2>
              <p className="mt-1 text-sm text-ink/60">This permanently removes your profile, addresses and points. Past orders stay with the restaurants without your name.</p>
              <button className="btn-danger mt-4" onClick={() => setDel(true)}>Delete my account</button>
            </div>
          </div>
        )}
      </main>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?" footer={<><button className="btn-outline" onClick={() => setDel(false)}>Keep my account</button><button className="btn-danger" onClick={remove}>Yes, delete permanently</button></>}>
        <p className="text-sm">This cannot be undone. You will be signed out on every device straight away.</p>
      </Modal>
    </>
  );
}
