import { Link } from 'react-router-dom';
import { ArrowRight, Store, ChefHat, Boxes, LineChart, MessageSquareText, Gamepad2, Globe, ReceiptText, Sparkles, MapPin, Clock } from 'lucide-react';
import { api, PHOTOS } from '../lib/api';
import { useLoad, Img, Stars } from '../components/ui';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const MODULES = [
  { icon: Globe, title: 'A website in minutes', text: 'Pick a layout, set your colors and publish. Your menu and ordering live at your own address.' },
  { icon: ReceiptText, title: 'POS and billing', text: 'Take walk-in orders, print a bill and record cash, card or online payments in one ledger.' },
  { icon: Store, title: 'Every branch, one login', text: 'Separate menus, stock and staff per branch, with one dashboard on top. Copy a menu across in a click.' },
  { icon: Boxes, title: 'Stock that predicts itself', text: 'Ingredients are deducted as dishes sell. Weekend and holiday forecasts build the purchase list for you.' },
  { icon: LineChart, title: 'Pricing with a reason', text: 'Slow dishes get offer suggestions, busy hours get peak pricing ideas. You approve every change.' },
  { icon: MessageSquareText, title: 'Reviews that sort themselves', text: 'Each review is tagged positive, neutral or negative with the topics behind it, so replies go to the right people first.' },
  { icon: Sparkles, title: 'Suggestions that sell', text: '"Suggested for you" and "Frequently bought together" learn from what your guests actually order.' },
  { icon: Gamepad2, title: 'Waiting made lighter', text: 'Guests play quick games while the kitchen cooks. A good score earns points or a small discount.' },
];

export default function Landing() {
  const { data: restaurants } = useLoad(async () => (await api.get('/public/restaurants')).data, []);
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-32 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">Take the orders.<br />Know what to cook,<br />stock and price.</h1>
            <p className="mt-6 max-w-lg text-lg text-ink/70">YumYard gives a restaurant its own ordering website, a point of sale and stock control, then reads the numbers back to you in plain language.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register-restaurant" className="btn-primary px-5 py-3">Apply with your restaurant <ArrowRight size={16} /></Link>
              <Link to="/restaurants" className="btn-outline px-5 py-3">Order some food</Link>
            </div>
            <p className="mt-4 text-sm text-ink/50">7 day free trial after approval. No card needed.</p>
          </div>
          <div className="relative">
            <img src={PHOTOS.hero} alt="A plated dish at a restaurant table" className="aspect-[4/5] w-full rounded-2xl object-cover shadow-lift" />
            <div className="absolute -bottom-6 -left-4 w-64 rounded-lg border border-ink/10 bg-white p-4 shadow-lift sm:-left-10">
              <div className="flex items-center justify-between text-xs text-ink/50"><span>Order YY204117</span><span className="rounded bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700">In kitchen</span></div>
              <p className="mt-2 flex items-center gap-2 font-display text-3xl font-extrabold"><Clock size={22} className="text-saffron-dark" /> 11:42</p>
              <p className="text-xs text-ink/60">Estimated time left. Chicken Biryani, Garlic Naan</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded bg-mist"><div className="h-full w-3/5 rounded bg-forest" /></div>
            </div>
          </div>
        </section>

        <section className="border-y border-ink/10 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 text-center sm:grid-cols-4">
            {[['7 days', 'free trial'], ['Live', 'order tracking'], ['1 login', 'for every branch'], ['0 setup fees', 'start in minutes']].map(([a, b]) => (
              <div key={a}><p className="font-display text-2xl font-extrabold text-forest">{a}</p><p className="text-sm text-ink/60">{b}</p></div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-5 md:grid-cols-2">
            <Link to="/restaurants" className="group relative overflow-hidden rounded-2xl">
              <img src={PHOTOS.spread} alt="" className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white"><h2 className="text-2xl font-bold">For hungry people</h2><p className="mt-1 max-w-sm text-sm text-white/80">Browse a menu, filter for halal or veg, pay your way and watch the countdown.</p></div>
            </Link>
            <Link to="/register-restaurant" className="group relative overflow-hidden rounded-2xl">
              <img src={PHOTOS.kitchen} alt="" className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white"><h2 className="text-2xl font-bold">For people who run kitchens</h2><p className="mt-1 max-w-sm text-sm text-white/80">Orders, stock, staff and reviews, without a spreadsheet in sight.</p></div>
            </Link>
          </div>
        </section>

        <section className="bg-forest py-20 text-white">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="max-w-xl text-3xl font-extrabold sm:text-4xl">Everything a restaurant needs, wired together</h2>
            <p className="mt-3 max-w-xl text-white/70">One sale updates the order queue, the ledger, the stock count and tomorrow's forecast.</p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map(({ icon: I, title, text }) => (
                <div key={title} className="bg-forest p-6"><I className="mb-4 text-saffron" size={24} /><h3 className="text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/70">{text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <img src={PHOTOS.interior} alt="A restaurant dining room" className="aspect-[4/3] w-full rounded-2xl object-cover" />
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Up and taking orders in three steps</h2>
              <ol className="mt-8 space-y-6">
                {[['Apply', 'Add your restaurant details and business documents. An administrator reviews them.'], ['Build', 'Set up branches, categories and dishes, then choose a look for your website.'], ['Serve', 'Orders arrive with a sound alert. Accept, cook, hand over, and the numbers fill themselves in.']].map(([t, d], i) => (
                  <li key={t} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron font-display font-extrabold">{i + 1}</span><div><h3 className="text-lg font-bold">{t}</h3><p className="text-sm text-ink/65">{d}</p></div></li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {restaurants?.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 pb-20">
            <div className="mb-6 flex items-end justify-between"><h2 className="text-2xl font-extrabold sm:text-3xl">Order from these restaurants</h2><Link to="/restaurants" className="text-sm font-semibold text-forest">See all</Link></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{restaurants.slice(0, 3).map((r) => <RestaurantCard key={r._id} r={r} />)}</div>
          </section>
        )}

        <section className="bg-saffron">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-5 py-14 sm:flex-row sm:items-center">
            <div><h2 className="text-3xl font-extrabold">Ready to run a tighter kitchen?</h2><p className="mt-1 text-ink/70">Apply today and your free trial starts the moment you are approved.</p></div>
            <Link to="/register-restaurant" className="btn bg-ink px-6 py-3 text-white hover:bg-black">Apply now <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function RestaurantCard({ r }) {
  return (
    <Link to={`/r/${r.slug}`} className="card group overflow-hidden transition-shadow hover:shadow-lift">
      <div className="relative h-44 overflow-hidden">
        <Img src={r.cover} alt={r.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {r.branches > 1 && <span className="absolute left-3 top-3 rounded bg-white/95 px-2 py-0.5 text-xs font-semibold">{r.branches} branches</span>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-bold">{r.name}</h3>{r.rating > 0 && <span className="flex items-center gap-1 text-sm font-semibold"><Stars value={1} size={14} />{r.rating}</span>}</div>
        <p className="mt-0.5 text-sm text-ink/60">{r.cuisine}</p>
        <p className="mt-2 line-clamp-2 text-sm text-ink/70">{r.tagline}</p>
      </div>
    </Link>
  );
}
