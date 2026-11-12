import { Link } from 'react-router-dom';
import { Logo } from './Navbar';

export default function Footer() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-sm text-sm">Online ordering, a point of sale, stock control and honest numbers for restaurants with one branch or twenty.</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Diners</p>
          <ul className="space-y-1.5"><li><Link to="/restaurants" className="hover:text-white">Browse restaurants</Link></li><li><Link to="/register" className="hover:text-white">Create an account</Link></li><li><Link to="/forgot-password" className="hover:text-white">Reset password</Link></li></ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Restaurants</p>
          <ul className="space-y-1.5"><li><Link to="/register-restaurant" className="hover:text-white">Apply to join</Link></li><li><Link to="/owner/login" className="hover:text-white">Owner login</Link></li><li><Link to="/admin/login" className="hover:text-white">Admin</Link></li></ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-center text-xs">YumYard Restaurants Management System. Final year project, Department of Computer Science, Federal Urdu University.</div>
    </footer>
  );
}
