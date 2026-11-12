import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu as MenuIcon, X } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext';

export const Logo = ({ light }) => (
  <span className="flex items-center gap-2">
    <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill={light ? '#F0A81F' : '#1F4D3A'} /><path d="M18 20l14 18 14-18" fill="none" stroke={light ? '#14211C' : '#F0A81F'} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><path d="M32 38v10" stroke={light ? '#14211C' : '#F0A81F'} strokeWidth="7" strokeLinecap="round" /></svg>
    <span className={`font-display text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>YumYard</span>
  </span>
);

// Compact floating bar
export default function Navbar() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }) => `rounded px-2.5 py-1 text-[13px] font-semibold ${isActive ? 'bg-forest-light text-forest' : 'text-ink/70 hover:text-ink'}`;
  return (
    <header className="fixed inset-x-0 top-3 z-40 flex justify-center px-3">
      <nav className="w-full max-w-2xl rounded-full border border-ink/10 bg-white/95 px-3 py-1.5 shadow-lift backdrop-blur" aria-label="Main">
        <div className="flex h-8 items-center justify-between gap-2">
          <Link to="/" aria-label="YumYard home" className="pl-1"><Logo /></Link>
          <div className="hidden items-center gap-0.5 sm:flex">
            <NavLink to="/restaurants" className={link}>Restaurants</NavLink>
            <NavLink to="/owner/login" className={link}>For owners</NavLink>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            {user ? (
              <>
                <button className="btn-primary btn-sm rounded-full" onClick={() => nav(homeFor(user))}>{user.role === 'customer' ? 'My account' : 'Dashboard'}</button>
                <button className="btn-ghost btn-sm rounded-full" onClick={async () => { await signOut(); nav('/'); }}>Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm rounded-full">Log in</Link>
                <Link to="/register" className="btn-primary btn-sm rounded-full">Sign up</Link>
              </>
            )}
          </div>
          <button className="rounded-full p-1.5 sm:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>{open ? <X size={18} /> : <MenuIcon size={18} />}</button>
        </div>
        {open && (
          <div className="mt-2 flex flex-col gap-1 border-t border-ink/10 pb-2 pt-2 sm:hidden" onClick={() => setOpen(false)}>
            <Link to="/restaurants" className="rounded px-2 py-2 text-sm font-semibold">Restaurants</Link>
            <Link to="/owner/login" className="rounded px-2 py-2 text-sm font-semibold">For owners</Link>
            {user ? (
              <>
                <Link to={homeFor(user)} className="rounded px-2 py-2 text-sm font-semibold">{user.role === 'customer' ? 'My account' : 'Dashboard'}</Link>
                <button className="rounded px-2 py-2 text-left text-sm font-semibold" onClick={async () => { await signOut(); nav('/'); }}>Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded px-2 py-2 text-sm font-semibold">Log in</Link>
                <Link to="/register" className="btn-primary mt-1">Sign up</Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
