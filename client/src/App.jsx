import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loading } from './components/ui';
import Landing from './pages/Landing';
import Restaurants from './pages/Restaurants';
import RestaurantSite from './pages/Storefront';
import OrderTrack from './pages/OrderTrack';
import Account from './pages/Account';
import { Login, Register, ForgotPassword, ResetPassword, RegisterRestaurant } from './pages/Auth';
import DashboardLayout from './components/DashboardLayout';
import AdminLayout from './components/AdminLayout';
import Overview from './pages/dash/Overview';
import Orders from './pages/dash/Orders';
import POS from './pages/dash/POS';
import Menu from './pages/dash/Menu';
import Inventory from './pages/dash/Inventory';
import AI from './pages/dash/AI';
import Reviews from './pages/dash/Reviews';
import Promotions from './pages/dash/Promotions';
import Branches from './pages/dash/Branches';
import Website from './pages/dash/Website';
import Team from './pages/dash/Team';
import Settings from './pages/dash/Settings';
import { AdminOverview, Approvals, Users, Restaurants as AdminRestaurants, System, Logs } from './pages/admin/Admin';

const STAFF = ['owner', 'manager', 'staff'];

function Guard({ roles, children, to = '/login' }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={to} state={{ from: loc.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
// Pages only owners and managers may open (staff are sent back to the overview)
const Lead = ({ children }) => { const { user } = useAuth(); return ['owner', 'manager'].includes(user.role) ? children : <Navigate to="/dashboard" replace />; };
const OwnerOnly = ({ children }) => { const { user } = useAuth(); return user.role === 'owner' ? children : <Navigate to="/dashboard" replace />; };

export default function App() {
  const { pathname } = useLocation();
  // scroll to the top when moving between pages
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/restaurants" element={<Restaurants />} />
      <Route path="/r/:slug" element={<RestaurantSite />} />
      <Route path="/track/:id" element={<OrderTrack />} />
      <Route path="/login" element={<Login portal="customer" />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register-restaurant" element={<RegisterRestaurant />} />
      <Route path="/owner/login" element={<Login portal="owner" />} />
      <Route path="/admin/login" element={<Login portal="admin" />} />
      <Route path="/account" element={<Guard roles={['customer']}><Account /></Guard>} />

      <Route path="/dashboard" element={<Guard roles={STAFF} to="/owner/login"><DashboardLayout /></Guard>}>
        <Route index element={<Overview />} />
        <Route path="orders" element={<Orders />} />
        <Route path="pos" element={<POS />} />
        <Route path="menu" element={<Menu />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="ai" element={<Lead><AI /></Lead>} />
        <Route path="promotions" element={<Lead><Promotions /></Lead>} />
        <Route path="branches" element={<Lead><Branches /></Lead>} />
        <Route path="website" element={<Lead><Website /></Lead>} />
        <Route path="team" element={<OwnerOnly><Team /></OwnerOnly>} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/admin" element={<Guard roles={['admin']} to="/admin/login"><AdminLayout /></Guard>}>
        <Route index element={<AdminOverview />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="users" element={<Users />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="system" element={<System />} />
        <Route path="logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center"><h1 className="text-5xl font-extrabold">404</h1><p className="text-ink/60">That page does not exist.</p><a href="/" className="btn-primary">Go home</a></div>} />
    </Routes>
  );
}
