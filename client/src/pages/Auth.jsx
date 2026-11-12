import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, Mail, FileText, Trash2 } from 'lucide-react';
import { api, errMsg, PHOTOS } from '../lib/api';
import { useAuth, homeFor } from '../context/AuthContext';
import { Field, ImageUpload } from '../components/ui';
import { Logo } from '../components/Navbar';

function Shell({ title, sub, children, photo = PHOTOS.table, quote }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="max-w-md font-display text-2xl font-bold leading-snug">{quote || 'Every order, branch and ingredient in one calm place.'}</p>
        </div>
      </div>
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="mb-10 w-fit"><Logo /></Link>
        <div className="m-auto w-full max-w-sm">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          {sub && <p className="mt-2 text-sm text-ink/60">{sub}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

const DevHint = ({ code }) => code ? <p className="mb-3 rounded-md border border-saffron/40 bg-saffron-light px-3 py-2 text-xs">Email is not configured, so here is your code for testing: <b className="tracking-widest">{code}</b></p> : null;

function OtpForm({ email, devOtp: initialDev, onDone, kind = 'verify', tempToken }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState(initialDev);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = kind === '2fa' ? await api.post('/auth/verify-2fa', { tempToken, code }) : await api.post('/auth/verify-email', { email, code });
      await onDone(data);
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  const resend = async () => {
    try { const { data } = await api.post('/auth/resend-otp', { email }); setDev(data.devOtp); toast.success('A new code is on its way'); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-3 rounded-md bg-forest-light p-3 text-sm">
        {kind === '2fa' ? <ShieldCheck className="mt-0.5 shrink-0 text-forest" size={18} /> : <Mail className="mt-0.5 shrink-0 text-forest" size={18} />}
        <span>We sent a 6 digit code to <b>{email}</b>. It expires in 10 minutes.</span>
      </div>
      <DevHint code={dev} />
      <Field label="Verification code"><input className="input text-center text-lg tracking-[0.5em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required /></Field>
      <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? 'Checking' : kind === '2fa' ? 'Sign in' : 'Verify and continue'}</button>
      {kind === 'verify' && <button type="button" onClick={resend} className="w-full text-center text-sm font-semibold text-forest hover:underline">Send a new code</button>}
    </form>
  );
}

const PORTALS = {
  owner: { title: 'Restaurant login', sub: 'Sign in to your restaurant dashboard.', photo: PHOTOS.kitchen, quote: 'Know what is cooking, what is running low and what to order tomorrow.' },
  admin: { title: 'Administrator login', sub: 'Restricted to platform administrators.', photo: PHOTOS.interior2, quote: 'Approve restaurants, manage users and keep the platform healthy.' },
};

export function Login({ portal }) {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(null); // {kind, email, devOtp, tempToken}
  const meta = PORTALS[portal] || { title: 'Welcome back', sub: 'Log in to order faster and track your meals.', photo: PHOTOS.table };

  const finish = async ({ token, user }) => { await signIn(token); toast.success(`Welcome, ${user.name.split(' ')[0]}`); nav(loc.state?.from || homeFor(user), { replace: true }); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { ...f, portal });
      if (data.twoFactorRequired) setStep({ kind: '2fa', email: f.email, devOtp: data.devOtp, tempToken: data.tempToken });
      else await finish(data);
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'UNVERIFIED') setStep({ kind: 'verify', email: d.email, devOtp: d.devOtp });
      else toast.error(errMsg(err));
    }
    setBusy(false);
  };

  return (
    <Shell {...meta} title={step ? (step.kind === '2fa' ? 'Two-step verification' : 'Verify your email') : meta.title} sub={step ? null : meta.sub}>
      {step ? <OtpForm {...step} onDone={finish} /> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
          <div className="text-right"><Link to="/forgot-password" className="text-xs font-semibold text-forest hover:underline">Forgot password?</Link></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in' : 'Log in'}</button>
          {!portal && <p className="text-center text-sm text-ink/60">New here? <Link to="/register" className="font-semibold text-forest">Create an account</Link></p>}
          {portal === 'owner' && <p className="text-center text-sm text-ink/60">Not on YumYard yet? <Link to="/register-restaurant" className="font-semibold text-forest">Apply to join</Link></p>}
        </form>
      )}
    </Shell>
  );
}

export function Register() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState(null);
  const done = async ({ token }) => { await signIn(token); toast.success('Your account is ready'); nav('/restaurants'); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/auth/register', f);
      if (data.needsVerification) setVerify(data); else await done(data);
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Shell title={verify ? 'Verify your email' : 'Create your account'} sub={verify ? null : 'Order from your favorite restaurants and follow every step.'} photo={PHOTOS.spread}>
      {verify ? <OtpForm email={verify.email} devOtp={verify.devOtp} onDone={done} /> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} required /></Field>
          <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} required /></Field>
          <Field label="Phone (optional)"><input className="input" value={f.phone} onChange={set('phone')} placeholder="+92 300 1234567" /></Field>
          <Field label="Password" hint="At least 8 characters with a letter and a number."><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account' : 'Create account'}</button>
          <p className="text-center text-sm text-ink/60">Already registered? <Link to="/login" className="font-semibold text-forest">Log in</Link></p>
        </form>
      )}
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/auth/forgot-password', { email }); setSent(data); } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <Shell title="Reset your password" sub="Enter the email you registered with and we will send you a secure link." photo={PHOTOS.bowl}>
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-md bg-forest-light p-4 text-sm">If <b>{email}</b> is registered, a recovery link is on its way. It works for one hour.</div>
          {sent.devLink && <p className="rounded-md border border-saffron/40 bg-saffron-light p-3 text-xs">Email is not configured, so here is the link for testing:<br /><a className="break-all font-semibold underline" href={sent.devLink}>{sent.devLink}</a></p>}
          <Link to="/login" className="btn-outline w-full">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending' : 'Send recovery link'}</button>
          <Link to="/login" className="block text-center text-sm font-semibold text-forest">Back to login</Link>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirm) return toast.error('The two passwords do not match.');
    setBusy(true);
    try { await api.post('/auth/reset-password', { token: sp.get('token'), password: f.password }); toast.success('Password updated. Please log in.'); nav('/login'); }
    catch (err) { if (/expired/i.test(errMsg(err))) setExpired(true); toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <Shell title="Choose a new password" photo={PHOTOS.bowl}>
      {expired || !sp.get('token') ? (
        <div className="space-y-4"><p className="text-sm">This link is no longer valid.</p><Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="At least 8 characters with a letter and a number."><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
          <Field label="Confirm password"><input className="input" type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving' : 'Update password'}</button>
        </form>
      )}
    </Shell>
  );
}

export function RegisterRestaurant() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', restaurantName: '', cuisine: '', address: '', city: '' });
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post('/auth/register-restaurant', { ...f, documents: docs });
      await signIn(data.token); toast.success('Application submitted'); nav('/dashboard');
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <Shell title="Apply to join YumYard" sub="Tell us about your restaurant. An administrator reviews every application, then your 7 day free trial starts." photo={PHOTOS.kitchen} quote="From one branch to twenty, your menu, orders and stock stay in sync.">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/50">You</p>
        <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} required /></Field>
          <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} placeholder="+92 300 1234567" /></Field>
        </div>
        <Field label="Password" hint="At least 8 characters with a letter and a number."><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required /></Field>
        <p className="pt-2 text-xs font-bold uppercase tracking-wide text-ink/50">Your restaurant</p>
        <Field label="Restaurant name"><input className="input" value={f.restaurantName} onChange={set('restaurantName')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuisine"><input className="input" value={f.cuisine} onChange={set('cuisine')} placeholder="Pakistani, BBQ" /></Field>
          <Field label="City"><input className="input" value={f.city} onChange={set('city')} /></Field>
        </div>
        <Field label="Address of your first branch"><input className="input" value={f.address} onChange={set('address')} required /></Field>
        <div>
          <span className="label">Business documents</span>
          <p className="mb-2 text-xs text-ink/50">Registration certificate, food authority license or NTN. JPG, PNG or PDF, up to 3 MB each.</p>
          {docs.map((d, i) => (
            <div key={i} className="mb-2 flex items-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm"><FileText size={16} className="text-forest" /><span className="flex-1 truncate">{d.name}</span><button type="button" onClick={() => setDocs(docs.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} className="text-chili" /></button></div>
          ))}
          <ImageUpload label="" allowPdf linkInput={false} value="" onChange={(url, name) => name && setDocs([...docs, { url, name }])} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Submitting' : 'Submit application'}</button>
        <p className="text-center text-sm text-ink/60">Already approved? <Link to="/owner/login" className="font-semibold text-forest">Owner login</Link></p>
      </form>
    </Shell>
  );
}
