import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { api, money } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, StatCard, Empty } from '../../components/ui';

const TONE = { danger: 'border-chili/30 bg-chili-light', warn: 'border-saffron/40 bg-saffron-light', good: 'border-forest/20 bg-forest-light', info: 'border-ink/10 bg-white' };
const ICON = { danger: AlertTriangle, warn: AlertTriangle, good: CheckCircle2, info: Info };
const axis = { fontSize: 11, fill: '#14211C99' };

export default function Overview() {
  const { branch } = useBranch();
  const [days, setDays] = useState(30);
  const { data: a, loading, error, reload } = useLoad(async () => (await api.get('/manage/analytics', { params: { branch, days } })).data, [branch, days]);
  const { data: tips } = useLoad(async () => (await api.get('/manage/ai/insights', { params: { branch } })).data, [branch]);

  if (loading && !a) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const g = a.week.growth;
  return (
    <>
      <PageHeader title="Overview" sub="A live picture of sales, orders and what needs attention." actions={
        <select className="input w-auto" value={days} onChange={(e) => setDays(+e.target.value)} aria-label="Date range"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={60}>Last 60 days</option></select>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Today's revenue" value={money(a.today.revenue)} sub={`${a.today.orders} orders`} />
        <StatCard label={`Revenue, ${days} days`} value={money(a.revenue)} sub={g !== null ? `${g >= 0 ? '+' : ''}${g}% vs last week` : undefined} />
        <StatCard label="Total orders" value={a.orders} />
        <StatCard label="Average order" value={money(a.avgOrder)} />
        <StatCard label="Active now" value={a.activeNow} sub={a.pendingNow ? `${a.pendingNow} waiting to be accepted` : 'Nothing waiting'} tone={a.pendingNow ? 'danger' : undefined} />
        <StatCard label="Guest rating" value={a.rating ? `${a.rating} / 5` : 'No reviews'} sub={`${a.reviews} reviews`} />
      </div>

      {tips?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Worth your attention</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tips.slice(0, 6).map((t, i) => { const I = ICON[t.tone] || Info; return (
              <Link key={i} to={t.link} className={`flex gap-3 rounded-lg border p-4 hover:shadow-lift ${TONE[t.tone]}`}><I size={18} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{t.title}</p><p className="mt-0.5 text-sm text-ink/70">{t.text}</p></div><ArrowRight size={16} className="mt-1 shrink-0 text-ink/40" /></Link>); })}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">Daily revenue</h2>
          <div className="h-64"><ResponsiveContainer><AreaChart data={a.byDay}><defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1F4D3A" stopOpacity={0.3} /><stop offset="100%" stopColor="#1F4D3A" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="#14211C14" vertical={false} /><XAxis dataKey="date" tick={axis} tickFormatter={(d) => d.slice(5)} minTickGap={24} /><YAxis tick={axis} width={52} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip formatter={(v) => money(v)} labelFormatter={(d) => d} /><Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1F4D3A" strokeWidth={2} fill="url(#rev)" /></AreaChart></ResponsiveContainer></div>
        </section>
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">This week vs last</h2>
            {g !== null && <span className={`flex items-center gap-1 text-sm font-bold ${g >= 0 ? 'text-forest' : 'text-chili'}`}>{g >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{g >= 0 ? '+' : ''}{g}%</span>}</div>
          <div className="h-64"><ResponsiveContainer><BarChart data={a.week.rows}><CartesianGrid stroke="#14211C14" vertical={false} /><XAxis dataKey="day" tick={axis} /><YAxis tick={axis} width={44} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} /><Tooltip formatter={(v) => money(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="lastWeek" name="Last week" fill="#14211C26" radius={[3, 3, 0, 0]} /><Bar dataKey="thisWeek" name="This week" fill="#1F4D3A" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Orders by hour</h2>
          <div className="h-52"><ResponsiveContainer><BarChart data={a.byHour}><XAxis dataKey="label" tick={axis} interval={1} /><YAxis tick={axis} width={28} allowDecimals={false} /><Tooltip /><Bar dataKey="orders" fill="#F0A81F" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Best sellers</h2>
          {a.topItems.length ? <ol className="space-y-2.5">{a.topItems.map((t, i) => (
            <li key={t.name} className="flex items-center gap-3 text-sm"><span className="w-5 font-display font-bold text-ink/40">{i + 1}</span><span className="flex-1 truncate font-semibold">{t.name}</span><span className="text-ink/60">{t.qty} sold</span></li>))}</ol> : <Empty title="No sales yet" />}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">Low stock {a.lowStock.length > 0 && <span className="badge bg-chili-light text-chili">{a.lowStock.length}</span>}</h2>
          {a.lowStock.length ? <ul className="space-y-2">{a.lowStock.slice(0, 6).map((s) => (
            <li key={s._id} className="flex items-center justify-between text-sm"><span><b>{s.name}</b> <span className="text-ink/50">{s.branch}</span></span><span className="font-semibold text-chili">{Math.round(s.quantity * 10) / 10} {s.unit}</span></li>))}
            <li><Link to="/dashboard/inventory" className="text-sm font-semibold text-forest">Open inventory</Link></li></ul> : <p className="text-sm text-ink/60">Everything is above its minimum level.</p>}
        </section>
      </div>

      {a.byBranch.length > 0 && (
        <section className="card mt-4 overflow-x-auto">
          <h2 className="p-5 pb-3 font-bold">Branch comparison</h2>
          <table className="w-full"><thead className="border-y border-ink/10 bg-paper"><tr><th className="th">Branch</th><th className="th">Revenue</th><th className="th">Orders</th><th className="th">Delayed orders</th></tr></thead>
            <tbody className="divide-y divide-ink/5">{a.byBranch.map((b) => <tr key={b.name}><td className="td font-semibold">{b.name}</td><td className="td">{money(b.revenue)}</td><td className="td">{b.orders}</td><td className="td"><span className={b.delayed / Math.max(1, b.orders) > 0.1 ? 'font-semibold text-chili' : ''}>{b.delayed}</span> <span className="text-ink/40">({Math.round((b.delayed / Math.max(1, b.orders)) * 100)}%)</span></td></tr>)}</tbody></table>
        </section>
      )}
    </>
  );
}
