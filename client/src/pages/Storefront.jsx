import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, ShoppingBag, MapPin, Clock, Phone, Plus, Flame, Zap, Instagram, Facebook, SlidersHorizontal, Sparkles, Quote } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money, PHOTOS } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLoad, Loading, Img, Stars, Badge, TAG_LABEL, TAG_STYLE } from '../components/ui';
import CartDrawer from '../components/Cart';
import Navbar from '../components/Navbar';

export const FONTS = ['Bricolage Grotesque', 'Fraunces', 'Playfair Display', 'Poppins', 'Lora', 'DM Serif Display', 'Space Grotesk'];

function useFont(font) {
  useEffect(() => {
    if (!font) return;
    const id = 'yy-font-' + font.replace(/\s/g, '');
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s/g, '+')}:wght@500;700;800&display=swap`;
    document.head.appendChild(l);
  }, [font]);
}

const PRICE_RANGES = [['all', 'Any price'], ['0-500', 'Under Rs 500'], ['500-1000', 'Rs 500 to 1,000'], ['1000-99999', 'Over Rs 1,000']];
const SORTS = [['featured', 'Featured'], ['low', 'Price: low to high'], ['high', 'Price: high to low']];
const TAGS = ['halal', 'veg', 'vegan', 'gluten-free', 'spicy'];

function MenuCard({ m, color, onAdd, layout }) {
  const discounted = m.livePrice < m.basePrice;
  const surged = m.livePrice > m.price;
  return (
    <article className={`card flex overflow-hidden ${layout === 'list' ? 'gap-4 p-3' : 'flex-col'}`}>
      <Img src={m.image} alt={m.name} className={layout === 'list' ? 'h-24 w-24 shrink-0 rounded-md object-cover' : 'h-44 w-full object-cover'} />
      <div className={`flex flex-1 flex-col ${layout === 'list' ? '' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-bold leading-tight">{m.name}</h3>
          {m.promoLabel && <span className="shrink-0 rounded bg-saffron px-1.5 py-0.5 text-[11px] font-bold">{m.promoLabel}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-ink/60">{m.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">{m.dietaryTags?.map((t) => <Badge key={t} className={TAG_STYLE[t]}>{t === 'spicy' && <Flame size={11} className="mr-0.5" />}{TAG_LABEL[t]}</Badge>)}</div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div>
            <span className="font-display text-lg font-extrabold">{money(m.livePrice)}</span>
            {discounted && <span className="ml-2 text-xs text-ink/40 line-through">{money(m.basePrice)}</span>}
            {surged && <span title="Peak hour pricing" className="ml-1.5 inline-flex items-center text-xs text-ink/50"><Zap size={11} /> peak</span>}
          </div>
          <button onClick={() => onAdd(m)} className="btn btn-sm text-white" style={{ background: color }} aria-label={`Add ${m.name} to order`}><Plus size={14} /> Add</button>
        </div>
      </div>
    </article>
  );
}

/* The generated restaurant website. Also used for the live preview in the website builder. */
export function Storefront({ data, preview = false, onBranchChange }) {
  const { restaurant: r, branches, branch, categories, menu, surge, reviews, rating, settings } = data;
  const cart = useCart();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tags, setTags] = useState([]);
  const [range, setRange] = useState('all');
  const [sort, setSort] = useState('featured');
  const [cat, setCat] = useState('all');
  const [suggest, setSuggest] = useState({ reason: '', items: [] });
  const [alt, setAlt] = useState([]);
  const menuRef = useRef();
  const p = r.theme?.primary || '#1F4D3A', s = r.theme?.secondary || '#F0A81F', font = r.theme?.font || 'Bricolage Grotesque';
  useFont(font);
  const tpl = r.template || 'modern';
  const curBranch = branches.find((b) => b._id === branch) || branches[0];

  useEffect(() => { if (!preview) cart.start(`${r._id}:${branch}`); /* eslint-disable-next-line */ }, [r._id, branch]);
  useEffect(() => {
    if (preview || !user || user.role !== 'customer') return setSuggest({ reason: '', items: [] });
    api.get(`/public/restaurants/${r.slug}/recommend`, { params: { branch } }).then((x) => setSuggest(x.data)).catch(() => {});
  }, [preview, user, r.slug, branch]);

  const filtered = useMemo(() => {
    const [lo, hi] = range === 'all' ? [0, 1e9] : range.split('-').map(Number);
    let list = menu.filter((m) => (cat === 'all' || m.category === cat) && m.livePrice >= lo && m.livePrice <= hi
      && tags.every((t) => m.dietaryTags?.includes(t)) && `${m.name} ${m.description}`.toLowerCase().includes(q.toLowerCase()));
    if (sort === 'low') list = [...list].sort((a, b) => a.livePrice - b.livePrice);
    if (sort === 'high') list = [...list].sort((a, b) => b.livePrice - a.livePrice);
    return list;
  }, [menu, q, tags, range, sort, cat]);

  // When nothing matches, suggest what other guests love instead
  useEffect(() => {
    if (preview || filtered.length || !menu.length) return setAlt([]);
    api.get(`/public/restaurants/${r.slug}/recommend`, { params: { branch } }).then((x) => setAlt(x.data.items)).catch(() => {});
  }, [filtered.length, preview, menu.length, r.slug, branch]);

  const add = (m) => {
    if (preview) return toast('This is a preview. Ordering is switched off here.');
    cart.add(m, m.price);
    if (user) api.post('/public/track', { itemId: m._id }).catch(() => {});
    toast.success(`${m.name} added`, { duration: 1200 });
  };
  const grouped = categories.map((c) => ({ c, items: filtered.filter((m) => m.category === c._id) })).filter((g) => g.items.length);
  const catName = (id) => categories.find((c) => c._id === id)?.name;
  const heading = { fontFamily: `"${font}", system-ui, sans-serif` };
  const cover = r.cover || PHOTOS.interior;
  const layout = tpl === 'classic' ? 'list' : 'grid';

  return (
    <div style={{ '--p': p, '--s': s, ...heading }} className="min-h-screen bg-paper">
      {/* Header */}
      <header className={`${preview ? '' : 'sticky top-0'} z-30 border-b border-ink/10 bg-white/95 backdrop-blur`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            {r.logo ? <Img src={r.logo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white" style={{ background: p }}>{r.name[0]}</span>}
            <span className="text-lg font-extrabold" style={heading}>{r.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {!preview && <Link to="/" className="hidden text-xs text-ink/50 hover:text-ink sm:block">Powered by YumYard</Link>}
            <button onClick={() => (preview ? toast('Cart is switched off in preview.') : setOpen(true))} className="btn relative text-white" style={{ background: p }} aria-label={`Open cart, ${cart.count} items`}>
              <ShoppingBag size={16} /> <span className="hidden sm:inline">Order</span>
              {!preview && cart.count > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-ink" style={{ background: s }}>{cart.count}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero, three layouts */}
      {tpl === 'modern' && (
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: p }}>{r.cuisine}</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl" style={heading}>{r.tagline || r.name}</h1>
            <p className="mt-4 max-w-md text-ink/70">{r.about?.slice(0, 180)}</p>
            <button onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })} className="btn mt-6 px-6 py-3 text-white" style={{ background: p }}>See the menu</button>
          </div>
          <Img src={cover} alt={`${r.name} interior`} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lift" />
        </section>
      )}
      {tpl === 'classic' && (
        <section className="relative">
          <Img src={cover} alt="" className="h-72 w-full object-cover sm:h-96" />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/55 px-5 text-center text-white">
            <p className="text-sm font-semibold tracking-wide" style={{ color: s }}>{r.cuisine}</p>
            <h1 className="mt-2 max-w-2xl text-4xl font-extrabold sm:text-5xl" style={heading}>{r.name}</h1>
            <p className="mt-3 max-w-xl text-white/85">{r.tagline}</p>
            <button onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })} className="btn mt-6 px-6 py-3 text-ink" style={{ background: s }}>View menu</button>
          </div>
        </section>
      )}
      {tpl === 'bold' && (
        <section style={{ background: p }} className="text-white">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <p className="text-sm font-bold" style={{ color: s }}>{r.cuisine}</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-extrabold leading-[1.02] sm:text-7xl" style={heading}>{r.name}</h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">{r.tagline}</p>
            <button onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })} className="btn mt-7 px-6 py-3 text-ink" style={{ background: s }}>Order now</button>
          </div>
          <Img src={cover} alt="" className="h-56 w-full object-cover sm:h-72" />
        </section>
      )}

      {/* Info strip */}
      <section className="border-y border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
          {rating.count > 0 && <span className="flex items-center gap-1.5 font-semibold"><Stars value={rating.avg} size={14} /> {rating.avg} <span className="font-normal text-ink/50">({rating.count})</span></span>}
          <span className="flex items-center gap-1.5 text-ink/70"><Clock size={14} /> {curBranch?.operatingHours || r.openingHours}</span>
          {r.phone && <span className="flex items-center gap-1.5 text-ink/70"><Phone size={14} /> {r.phone}</span>}
          {branches.length > 1 && (
            <label className="ml-auto flex items-center gap-2"><MapPin size={14} /><span className="sr-only">Branch</span>
              <select className="rounded-md border border-ink/20 bg-white px-2 py-1 text-sm font-semibold" value={branch} onChange={(e) => onBranchChange?.(e.target.value)}>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
            </label>
          )}
        </div>
        {surge && <p className="border-t border-ink/10 bg-saffron-light px-5 py-1.5 text-center text-xs font-semibold"><Zap size={12} className="mr-1 inline" />Busy hours: prices are {surge.pct}% higher right now.</p>}
      </section>

      <main ref={menuRef} className="mx-auto max-w-6xl px-5 py-10">
        {suggest.items.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold" style={heading}><Sparkles size={18} style={{ color: p }} /> {suggest.reason === 'Suggested for you' ? 'Suggested for you' : 'Popular right now'}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{suggest.items.map((m) => <MenuCard key={m._id} m={{ ...m, livePrice: menu.find((x) => x._id === m._id)?.livePrice ?? m.price }} color={p} onAdd={add} />)}</div>
          </section>
        )}

        {/* Smart browsing */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 text-ink/40" size={18} /><input className="input pl-10" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the menu" /></div>
            <select className="input w-auto" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Price range">{PRICE_RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={15} className="text-ink/40" />
            {TAGS.map((t) => (
              <button key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} aria-pressed={tags.includes(t)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${tags.includes(t) ? 'border-transparent text-white' : 'border-ink/20 bg-white'}`} style={tags.includes(t) ? { background: p } : {}}>{TAG_LABEL[t]}</button>
            ))}
            {(tags.length > 0 || range !== 'all' || q) && <button onClick={() => { setTags([]); setRange('all'); setQ(''); }} className="text-xs font-semibold text-ink/60 underline">Clear filters</button>}
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-ink/10" role="tablist">
            {[{ _id: 'all', name: 'All' }, ...categories].map((c) => (
              <button key={c._id} role="tab" aria-selected={cat === c._id} onClick={() => setCat(c._id)} className="whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold" style={cat === c._id ? { borderColor: p, color: p } : { borderColor: 'transparent', color: 'rgba(20,33,28,.6)' }}>{c.name}</button>
            ))}
          </div>
        </div>

        {menu.length === 0 ? <p className="py-16 text-center text-ink/60">This branch has not published its menu yet.</p>
          : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-display text-xl font-bold">No dishes match your search</p>
              <p className="mt-1 text-sm text-ink/60">Try fewer filters. Here are some favorites instead.</p>
              {alt.length > 0 && <div className="mx-auto mt-6 grid max-w-4xl gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">{alt.map((m) => <MenuCard key={m._id} m={{ ...m, livePrice: menu.find((x) => x._id === m._id)?.livePrice ?? m.price }} color={p} onAdd={add} />)}</div>}
            </div>
          ) : (
            <div className="space-y-10">
              {grouped.map(({ c, items }) => (
                <section key={c._id}>
                  <h2 className="mb-4 text-2xl font-extrabold" style={heading}>{c.name}</h2>
                  <div className={layout === 'list' ? 'grid gap-3 md:grid-cols-2' : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'}>{items.map((m) => <MenuCard key={m._id} m={m} color={p} onAdd={add} layout={layout} />)}</div>
                </section>
              ))}
            </div>
          )}
      </main>

      {/* About, gallery, reviews, locations */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold" style={heading}>Our story</h2>
            <p className="mt-4 leading-relaxed text-ink/70">{r.about}</p>
            {r.gallery?.length > 0 && <div className="mt-6 grid grid-cols-3 gap-2">{r.gallery.slice(0, 3).map((g, i) => <Img key={i} src={g} alt="" className="aspect-square w-full rounded-md object-cover" />)}</div>}
          </div>
          <div>
            <h2 className="text-3xl font-extrabold" style={heading}>Find us</h2>
            <div className="mt-4 space-y-4">
              {branches.map((b) => (
                <div key={b._id} className="rounded-lg border border-ink/10 p-4">
                  <p className="font-bold">{b.name}</p><p className="text-sm text-ink/70">{b.address}{b.city ? `, ${b.city}` : ''}</p><p className="mt-1 text-xs text-ink/50">{b.operatingHours}{b.phone ? ` · ${b.phone}` : ''}</p>
                  {b._id === (curBranch?._id) && b.geo?.lat && (
                    <iframe title={`Map of ${b.name}`} className="mt-3 h-40 w-full rounded-md border-0" loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${b.geo.lng - 0.008},${b.geo.lat - 0.005},${b.geo.lng + 0.008},${b.geo.lat + 0.005}&layer=mapnik&marker=${b.geo.lat},${b.geo.lng}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="mb-6 text-3xl font-extrabold" style={heading}>What guests say</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 3).map((v) => (
              <figure key={v._id} className="card p-5">
                <Quote size={18} style={{ color: s }} /><blockquote className="mt-2 text-sm leading-relaxed">{v.comment}</blockquote>
                <figcaption className="mt-3 flex items-center justify-between text-sm"><span className="font-semibold">{v.name}</span><Stars value={v.rating} size={13} /></figcaption>
                {v.reply && <p className="mt-3 rounded bg-paper p-2.5 text-xs text-ink/70"><b>{r.name}:</b> {v.reply}</p>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="text-white" style={{ background: p }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm">
          <p className="font-bold" style={heading}>{r.name}</p>
          <div className="flex items-center gap-4 text-white/80">
            {r.social?.instagram && <span className="flex items-center gap-1"><Instagram size={14} /> {r.social.instagram}</span>}
            {r.social?.facebook && <span className="flex items-center gap-1"><Facebook size={14} /> {r.social.facebook}</span>}
          </div>
          <p className="text-white/60">Ordering by YumYard</p>
        </div>
      </footer>

      {!preview && <CartDrawer open={open} onClose={() => setOpen(false)} slug={r.slug} branch={branch} settings={settings} menu={menu} color={p} />}
    </div>
  );
}

export default function RestaurantSite() {
  const { slug } = useParams();
  const [branch, setBranch] = useState(null);
  const { data, loading, error } = useLoad(async () => (await api.get(`/public/restaurants/${slug}`, { params: branch ? { branch } : {} })).data, [slug, branch]);
  if (loading && !data) return <><Navbar /><Loading text="Setting the table" /></>;
  if (error && !data) return (
    <><Navbar /><main className="mx-auto max-w-md px-5 pt-40 text-center"><h1 className="text-3xl font-extrabold">Restaurant unavailable</h1><p className="mt-3 text-ink/60">{error}</p><Link to="/restaurants" className="btn-primary mt-6">Browse other restaurants</Link></main></>
  );
  return <Storefront data={data} onBranchChange={setBranch} />;
}
