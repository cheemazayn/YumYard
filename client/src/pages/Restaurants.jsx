import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad, Loading, ErrorBox, Empty } from '../components/ui';
import { RestaurantCard } from './Landing';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Restaurants() {
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/public/restaurants')).data, []);
  const [q, setQ] = useState('');
  const list = useMemo(() => (data || []).filter((r) => `${r.name} ${r.cuisine} ${r.tagline}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-6xl px-5 pb-20 pt-28">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Restaurants near you</h1>
        <p className="mt-2 text-ink/60">Pick a place, choose a branch and order in a few taps.</p>
        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3 top-2.5 text-ink/40" size={18} />
          <input className="input pl-10" placeholder="Search by name or cuisine" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search restaurants" />
        </div>
        <div className="mt-8">
          {loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : list.length === 0 ? (
            <Empty title="No restaurants found" hint={q ? 'Try a different search.' : 'New restaurants are being approved. Check back soon.'} />
          ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((r) => <RestaurantCard key={r._id} r={r} />)}</div>}
        </div>
      </main>
      <Footer />
    </>
  );
}
