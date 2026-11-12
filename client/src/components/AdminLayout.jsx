import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, BadgeCheck, Users, Store, SlidersHorizontal, ScrollText, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Navbar';
import { Loading } from './ui';

const NAV = [
  { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/approvals', label: 'Approvals', icon: BadgeCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/restaurants', label: 'Restaurants', icon: Store },
  { to: '/admin/system', label: 'System controls', icon: SlidersHorizontal },
  { to: '/admin/logs', label: 'Activity logs', icon: ScrollText },
];

export default function AdminLayout() {
  const { user, signOut, loading } = useAuth();
  const nav = useNavigate();
  if (loading) return <Loading />;
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink md:flex">
        <div className="px-5 py-5"><Link to="/admin"><Logo light /></Link><p className="mt-1 text-xs text-white/50">Administration</p></div>
        <ul className="flex-1 space-y-0.5 px-3">{NAV.map(({ to, end, label, icon: I }) => <li key={to}><NavLink to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-saffron text-ink' : 'text-white/75 hover:bg-white/10'}`}><I size={17} />{label}</NavLink></li>)}</ul>
        <div className="border-t border-white/10 p-3"><button onClick={async () => { await signOut(); nav('/'); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10"><LogOut size={17} />Log out</button></div>
      </aside>
      <div className="flex-1 md:pl-60">
        <nav className="flex gap-1 overflow-x-auto border-b border-ink/10 bg-white px-3 py-2 md:hidden">{NAV.map(({ to, end, label }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-saffron' : ''}`}>{label}</NavLink>)}</nav>
        <header className="hidden items-center justify-end border-b border-ink/10 bg-white px-6 py-3 text-sm text-ink/60 md:flex">{user.name} · administrator</header>
        <main className="px-4 py-6 sm:px-6"><Outlet /></main>
      </div>
    </div>
  );
}
