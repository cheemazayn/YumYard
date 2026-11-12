import { useEffect, useState } from 'react';
import { Monitor, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, fmtDateTime } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLoad, Loading, ErrorBox, PageHeader, Tabs, Field, ImageUpload, Toggle, Badge } from '../../components/ui';

export function Security() {
  const { user, refresh } = useAuth();
  const [pw, setPw] = useState({ current: '', next: '' });
  const { data: sessions, loading, reload } = useLoad(async () => (await api.get('/auth/sessions')).data, []);
  const changePw = async (e) => { e.preventDefault(); try { await api.post('/auth/change-password', pw); setPw({ current: '', next: '' }); toast.success('Password changed. Other devices were signed out.'); reload(); } catch (err) { toast.error(errMsg(err)); } };
  const twoFa = async (enabled) => { try { await api.post('/auth/2fa', { enabled }); await refresh(); toast.success(enabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'); } catch (err) { toast.error(errMsg(err)); } };
  const end = async (id) => { try { await api.delete(`/auth/sessions/${id}`); toast.success('Signed out'); reload(); } catch (err) { toast.error(errMsg(err)); } };
  const endAll = async () => { try { await api.delete('/auth/sessions'); toast.success('Other devices were signed out'); reload(); } catch (err) { toast.error(errMsg(err)); } };
  return (
    <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
      <form onSubmit={changePw} className="card h-fit space-y-4 p-6"><h2 className="text-lg font-bold">Change password</h2>
        <Field label="Current password"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
        <Field label="New password" hint="At least 8 characters with a letter and a number."><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
        <button className="btn-primary">Update password</button></form>
      <div className="space-y-5">
        <section className="card p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-forest" size={22} /><div className="flex-1"><h2 className="text-lg font-bold">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-ink/60">Each time you sign in, we email a 6 digit code that you enter after your password.</p>
          <div className="mt-3"><Toggle checked={!!user.twoFactorEnabled} onChange={twoFa} label={user.twoFactorEnabled ? 'On' : 'Off'} /></div></div></div></section>
        <section className="card p-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Active sessions</h2>{sessions?.length > 1 && <button className="btn-outline btn-sm" onClick={endAll}>Sign out other devices</button>}</div>
          {loading && !sessions ? <Loading /> : <ul className="divide-y divide-ink/10">{sessions?.map((s) => (
            <li key={s._id} className="flex items-center gap-3 py-3"><Monitor size={18} className="shrink-0 text-ink/40" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{s.device}</p><p className="text-xs text-ink/50">{s.ip} · {fmtDateTime(s.createdAt)}</p></div>
              {s.current ? <Badge className="bg-forest-light text-forest">This device</Badge> : <button className="btn-outline btn-sm" onClick={() => end(s._id)}>Sign out</button>}</li>))}</ul>}</section>
      </div>
    </div>
  );
}

function Business() {
  const { data: r, loading, error, reload } = useLoad(async () => (await api.get('/manage/restaurant')).data, []);
  const { user } = useAuth();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (r) setF({ name: r.name, phone: r.phone || '', email: r.email || '', openingHours: r.openingHours || '', logo: r.logo || '', cover: r.cover || '', gallery: r.gallery || [], social: { instagram: r.social?.instagram || '', facebook: r.social?.facebook || '' } }); }, [r]);
  if (loading && !r) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!f) return null;
  const lead = ['owner', 'manager'].includes(user.role);
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api.put('/manage/restaurant', f); toast.success('Business profile updated'); reload(); } catch (err) { toast.error(errMsg(err)); } setBusy(false); };
  return (
    <form onSubmit={save} className="card max-w-3xl space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Restaurant name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} disabled={!lead} /></Field>
        <Field label="Opening hours"><input className="input" value={f.openingHours} onChange={(e) => set('openingHours', e.target.value)} disabled={!lead} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} disabled={!lead} /></Field>
        <Field label="Public email"><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={!lead} /></Field>
        <Field label="Instagram"><input className="input" value={f.social.instagram} onChange={(e) => set('social', { ...f.social, instagram: e.target.value })} disabled={!lead} /></Field>
        <Field label="Facebook"><input className="input" value={f.social.facebook} onChange={(e) => set('social', { ...f.social, facebook: e.target.value })} disabled={!lead} /></Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2"><ImageUpload label="Logo (JPG or PNG)" aspect="aspect-square" value={f.logo} onChange={(u) => set('logo', u)} /><ImageUpload label="Promotional banner" value={f.cover} onChange={(u) => set('cover', u)} /></div>
      <div><span className="label">Gallery photos (up to 3)</span><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <ImageUpload key={i} label="" linkInput={false} aspect="aspect-square" value={f.gallery[i]} onChange={(u) => { const g = [...f.gallery]; g[i] = u; set('gallery', g.filter(Boolean)); }} />)}</div></div>
      <p className="text-sm text-ink/60">Branch addresses and map locations are managed under <b>Branches</b>.</p>
      {lead && <button className="btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save profile'}</button>}
    </form>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('business');
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'business', label: 'Business profile' }, { id: 'security', label: 'Security' }]} />
      {tab === 'business' ? <Business /> : <Security />}
    </>
  );
}
