import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, ReceiptText, UtensilsCrossed, Boxes, Sparkles, MessageSquareText, Percent, GitBranch, Globe, Users, Settings, Bell, LogOut, Menu as MenuIcon, X, Clock, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, getSocket, fmtDateTime } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { BranchCtx } from '../context/BranchContext';
import { chime } from '../lib/sound';
import { Logo } from './Navbar';
import { Loading } from './ui';

const NAV = [
  { to: '/dashboard', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/orders', label: 'Orders', icon: ClipboardList },
  { to: '/dashboard/pos', label: 'POS and payments', icon: ReceiptText },
  { to: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/dashboard/inventory', label: 'Inventory', icon: Boxes },
  { to: '/dashboard/ai', label: 'AI insights', icon: Sparkles, lead: true },
  { to: '/dashboard/reviews', label: 'Reviews', icon: MessageSquareText },
  { to: '/dashboard/promotions', label: 'Promotions', icon: Percent, lead: true },
  { to: '/dashboard/branches', label: 'Branches', icon: GitBranch, lead: true },
  { to: '/dashboard/website', label: 'Website', icon: Globe, lead: true },
  { to: '/dashboard/team', label: 'Team', icon: Users, owner: true },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function Bell_({ unread, items, onOpen }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open) onOpen(); }} className="relative rounded-full p-2 hover:bg-ink/5" aria-label={`Notifications, ${unread} unread`}>
        <Bell size={18} />{unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-chili px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-lg border border-ink/10 bg-white shadow-lift">
          <p className="border-b border-ink/10 px-4 py-2.5 text-sm font-bold">Notifications</p>
          <ul className="max-h-80 divide-y divide-ink/5 overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-sm text-ink/60">Nothing yet.</li>}
            {items.map((n) => (
              <li key={n._id}><button className={`w-full px-4 py-3 text-left text-sm hover:bg-paper ${n.isRead ? '' : 'bg-saffron-light/50'}`} onClick={() => { setOpen(false); n.link && nav(n.link); }}>
                <p>{n.message}</p><p className="mt-0.5 text-xs text-ink/50">{fmtDateTime(n.createdAt)}</p></button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Gate({ restaurant, signOut }) {
  const rejected = restaurant.status === 'rejected';
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="card max-w-md p-8 text-center">
        <Clock size={36} className={`mx-auto ${rejected ? 'text-chili' : 'text-saffron-dark'}`} />
        <h1 className="mt-4 text-2xl font-extrabold">{rejected ? 'Application not approved' : 'Application under review'}</h1>
        <p className="mt-2 text-sm text-ink/70">{rejected ? restaurant.rejectionReason || 'Please contact support.' : `${restaurant.name} is waiting for an administrator to review your documents. You will get a notification as soon as it is approved, and your 7 day free trial starts then.`}</p>
        <button className="btn-outline mt-6" onClick={signOut}>Log out</button>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, restaurant, signOut, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('');
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const timer = useRef();
  const canPick = ['owner', 'manager'].includes(user?.role);

  const loadNotes = () => api.get('/notifications').then((r) => setNotes(r.data)).catch(() => {});
  useEffect(() => {
    if (!user || restaurant?.status !== 'active') return;
    api.get('/manage/branches').then((r) => setBranches(r.data)).catch(() => {});
    loadNotes(); timer.current = setInterval(loadNotes, 30000);
    const s = getSocket();
    s.emit('join', `restaurant:${user.restaurant}`);
    const onNew = (o) => { chime(); toast.success(`New order ${o.orderNo}`, { duration: 6000 }); loadNotes(); };
    s.on('order:new', onNew);
    return () => { clearInterval(timer.current); s.off('order:new', onNew); };
  // eslint-disable-next-line
  }, [user?._id, restaurant?.status]);

  if (loading) return <Loading />;
  if (restaurant && restaurant.status !== 'active') return <Gate restaurant={restaurant} signOut={async () => { await signOut(); nav('/'); }} />;

  const daysLeft = restaurant?.plan?.status === 'trial' ? Math.ceil((new Date(restaurant.plan.trialEndsAt) - Date.now()) / 864e5) : null;
  const expired = restaurant?.plan?.status === 'expired' || (daysLeft !== null && daysLeft <= 0);
  const activate = async () => {
    try { await api.post('/manage/restaurant/activate'); toast.success('Subscription activated'); refresh(); } catch (e) { toast.error(errMsg(e)); }
  };
  const items = NAV.filter((n) => (!n.lead || canPick) && (!n.owner || user.role === 'owner'));

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Dashboard">
      <div className="flex items-center justify-between px-5 py-5"><Link to="/dashboard"><Logo light /></Link><button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <p className="px-5 pb-3 text-xs text-white/50">{restaurant?.name}</p>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map(({ to, end, label: l, icon: I }) => (
          <li key={to}><NavLink to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-saffron text-ink' : 'text-white/75 hover:bg-white/10'}`}><I size={17} />{l}</NavLink></li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-white/10 p-3">
        {restaurant?.slug && <a href={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10"><ExternalLink size={17} />View my website</a>}
        <button onClick={async () => { await signOut(); nav('/'); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10"><LogOut size={17} />Log out</button>
      </div>
    </nav>
  );

  return (
    <BranchCtx.Provider value={{ branches, branch: canPick ? branch : user.branch || '', setBranch, canPick }}>
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-ink lg:block">{sidebar}</aside>
        {open && <div className="fixed inset-0 z-40 bg-ink/60 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-64 bg-ink" onClick={(e) => e.stopPropagation()}>{sidebar}</aside></div>}
        <div className="flex-1 lg:pl-60">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink/10 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2">
              <button className="rounded p-2 hover:bg-ink/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon size={18} /></button>
              {canPick && branches.length > 1 ? (
                <select className="rounded-md border border-ink/20 bg-white px-3 py-1.5 text-sm font-semibold" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch filter"><option value="">All branches</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
              ) : <span className="text-sm font-semibold text-ink/70">{branches[0]?.name}</span>}
            </div>
            <div className="flex items-center gap-2"><span className="hidden text-sm text-ink/60 sm:block">{user.name} · {user.role}</span><Bell_ unread={notes.unread} items={notes.items} onOpen={() => { api.post('/notifications/read').then(() => setTimeout(loadNotes, 1500)); }} /></div>
          </header>
          {(daysLeft !== null || expired) && (
            <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6 ${expired ? 'bg-chili-light text-chili' : 'bg-saffron-light'}`}>
              <span>{expired ? 'Your free trial has ended. Your site and dashboard are read-only until you subscribe.' : `Free trial: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`}</span>
              {user.role === 'owner' && <button onClick={activate} className="btn-primary btn-sm">Activate subscription</button>}
            </div>
          )}
          <main className="px-4 py-6 sm:px-6"><Outlet /></main>
        </div>
      </div>
    </BranchCtx.Provider>
  );
}
