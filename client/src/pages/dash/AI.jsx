import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, TrendingUp, Zap, Check, RotateCcw, FileText, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg, money, fmtDate } from '../../lib/api';
import { useBranch } from '../../context/BranchContext';
import { useLoad, Loading, ErrorBox, PageHeader, Tabs, Img, Badge, Empty, StatCard, Stars } from '../../components/ui';

const hr = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

function Pricing() {
  const { branch } = useBranch();
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/ai/pricing', { params: { branch } })).data, [branch]);
  const [busy, setBusy] = useState('');
  if (loading && !data) return <Loading text="Reading your sales" />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const act = async (s, reset) => {
    setBusy(s.itemId);
    try { await api.post('/manage/ai/pricing/apply', { itemId: s.itemId, price: s.suggestedPrice, reset }); toast.success(reset ? `${s.name} is back to its normal price` : `${s.name} is now ${money(s.suggestedPrice)}`); reload(); } catch (e) { toast.error(errMsg(e)); }
    setBusy('');
  };
  const sg = data.surge;
  const toggleSurge = async (enabled) => {
    try { await api.post('/manage/ai/surge', { enabled, pct: sg.suggestion?.pct, hours: sg.suggestion?.hours }); toast.success(enabled ? 'Peak-hour pricing is on' : 'Peak-hour pricing is off'); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const list = data.suggestions.filter((s) => s.action !== 'hold');
  return (
    <>
      <p className="mb-5 max-w-2xl text-sm text-ink/60">Based on {data.ordersAnalysed} orders from the last 30 days. Nothing changes until you approve it, and you can undo any change.</p>
      <section className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3"><Zap className="mt-0.5 text-saffron-dark" size={20} /><div><h2 className="font-bold">Peak-hour pricing</h2>
            {sg.current.enabled ? <p className="text-sm text-ink/70">On: <b>+{sg.current.pct}%</b> during {sg.current.hours.map(hr).join(', ')}. Guests see a notice on your website.</p>
              : sg.suggestion ? <p className="max-w-xl text-sm text-ink/70">{sg.suggestion.reason} Suggested <b>+{sg.suggestion.pct}%</b> during <b>{sg.suggestion.hours.map(hr).join(', ')}</b>.</p> : <p className="text-sm text-ink/70">Traffic is evenly spread, so there is no peak to price for.</p>}</div></div>
          {sg.current.enabled ? <button className="btn-outline" onClick={() => toggleSurge(false)}>Turn off</button> : sg.suggestion && <button className="btn-primary" onClick={() => toggleSurge(true)}>Approve and turn on</button>}
        </div>
        {data.slowHours.length > 0 && <p className="mt-3 border-t border-ink/10 pt-3 text-sm text-ink/60">Quietest hours: {data.slowHours.map(hr).join(', ')}. A <Link to="/dashboard/promotions" className="font-semibold text-forest">happy-hour coupon</Link> could fill them.</p>}
      </section>
      {!list.length ? <Empty title="No price changes suggested" hint="Every dish is selling in line with the menu. Check back as more orders come in." /> : (
        <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Dish', 'Sold (30d)', 'Now', 'Suggested', 'Why', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink/5">{list.map((s) => (
            <tr key={s.itemId}><td className="td"><div className="flex items-center gap-3"><Img src={s.image} className="h-10 w-10 rounded object-cover" /><div><p className="font-semibold">{s.name}</p><p className="text-xs text-ink/50">{s.branch}</p></div></div></td>
              <td className="td">{s.sold}</td><td className="td">{money(s.currentPrice)}</td>
              <td className="td"><span className={`inline-flex items-center gap-1 font-bold ${s.action === 'discount' ? 'text-chili' : 'text-forest'}`}>{s.action === 'discount' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}{money(s.suggestedPrice)} <span className="text-xs">({s.change > 0 ? '+' : ''}{s.change}%)</span></span></td>
              <td className="td max-w-sm text-sm text-ink/70">{s.reason}</td>
              <td className="td text-right">{s.applied ? <button className="btn-outline btn-sm" disabled={busy === s.itemId} onClick={() => act(s, true)}><RotateCcw size={13} />Undo</button> : <button className="btn-primary btn-sm" disabled={busy === s.itemId} onClick={() => act(s)}><Check size={13} />Apply</button>}</td></tr>))}</tbody></table></div>
      )}
    </>
  );
}

const SENT = { positive: '#1F4D3A', neutral: '#C9CDC5', negative: '#C7402D' };
function Sentiment() {
  const { branch } = useBranch();
  const { data: s, loading, error, reload } = useLoad(async () => (await api.get('/manage/ai/sentiment', { params: { branch } })).data, [branch]);
  if (loading && !s) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!s.total) return <Empty title="No reviews yet" hint="Guests can rate their order once it is complete. Reviews are analysed as they arrive." />;
  const pie = Object.entries(s.counts).map(([name, value]) => ({ name, value }));
  return (
    <>
      {s.digest && <p className="mb-5 rounded-lg border border-forest/20 bg-forest-light p-4 text-sm leading-relaxed">{s.digest}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Average rating" value={`${s.avgRating} / 5`} /><StatCard label="Positive" value={s.counts.positive} /><StatCard label="Neutral" value={s.counts.neutral} /><StatCard label="Negative" value={s.counts.negative} tone={s.counts.negative ? 'danger' : undefined} sub={`${s.alerts.length} unanswered this week`} /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5"><h2 className="mb-2 font-bold">Mood split</h2><div className="h-48"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>{pie.map((p) => <Cell key={p.name} fill={SENT[p.name]} />)}</Pie><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer></div></section>
        <section className="card p-5 lg:col-span-2"><h2 className="mb-2 font-bold">Sentiment by topic</h2><div className="h-48"><ResponsiveContainer><BarChart data={s.topics} layout="vertical"><XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} /><YAxis type="category" dataKey="topic" width={90} tick={{ fontSize: 12 }} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {['positive', 'neutral', 'negative'].map((k) => <Bar key={k} dataKey={k} stackId="a" fill={SENT[k]} />)}</BarChart></ResponsiveContainer></div></section>
        <section className="card p-5 lg:col-span-3"><h2 className="mb-2 font-bold">Average sentiment, last 8 weeks</h2><p className="mb-2 text-xs text-ink/50">From -1 (very negative) to +1 (very positive).</p><div className="h-48"><ResponsiveContainer><LineChart data={s.trend}><CartesianGrid stroke="#14211C14" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis domain={[-1, 1]} width={30} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#1F4D3A" strokeWidth={2} connectNulls dot /></LineChart></ResponsiveContainer></div></section>
      </div>
      {s.alerts.length > 0 && <section className="mt-5"><h2 className="mb-3 font-bold text-chili">Negative reviews waiting for a reply</h2><ul className="space-y-2">{s.alerts.slice(0, 5).map((r) => <li key={r._id} className="card flex flex-wrap items-center justify-between gap-2 border-chili/30 p-4 text-sm"><div><Stars value={r.rating} size={13} /><p className="mt-1">{r.comment}</p></div><Link to="/dashboard/reviews" className="btn-outline btn-sm">Reply</Link></li>)}</ul></section>}
    </>
  );
}

function Profit() {
  const { branch } = useBranch();
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/ai/profitability', { params: { branch } })).data, [branch]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data.length) return <Empty title="Not enough sales yet" hint="Rankings appear once dishes start selling. Add each dish's food cost for exact margins." />;
  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-ink/60">Profit is revenue minus food cost for the last 30 days. Dishes without a cost use an estimate of 40% of the price, so add real costs on the menu page.</p>
      <div className="card mb-5 p-5"><h2 className="mb-3 font-bold">Top 8 by profit</h2><div className="h-72"><ResponsiveContainer><BarChart data={data.slice(0, 8)} layout="vertical"><XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} /><Tooltip formatter={(v) => money(v)} /><Bar dataKey="profit" name="Profit" fill="#1F4D3A" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="card overflow-x-auto"><table className="w-full"><thead className="border-b border-ink/10 bg-paper"><tr>{['Rank', 'Dish', 'Sold', 'Revenue', 'Profit', 'Margin'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink/5">{data.map((d, i) => <tr key={d.name}><td className="td font-display font-bold text-ink/40">{i + 1}</td><td className="td font-semibold">{d.name}</td><td className="td">{d.qty}</td><td className="td">{money(d.revenue)}</td><td className="td">{money(d.profit)}</td><td className="td"><Badge className={d.margin >= 60 ? 'bg-forest-light text-forest' : d.margin >= 45 ? 'bg-saffron-light text-saffron-dark' : 'bg-chili-light text-chili'}>{d.margin}%</Badge></td></tr>)}</tbody></table></div>
    </>
  );
}

function Reports() {
  const { data, loading, error, reload } = useLoad(async () => (await api.get('/manage/reports')).data, []);
  const [busy, setBusy] = useState(false);
  const gen = async () => { setBusy(true); try { await api.post('/manage/reports'); toast.success('Report ready'); reload(); } catch (e) { toast.error(errMsg(e)); } setBusy(false); };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return (
    <>
      <div className="mb-4 flex items-center justify-between"><p className="text-sm text-ink/60">A report is created automatically every week. You can also create one now.</p><button className="btn-primary" disabled={busy} onClick={gen}><FileText size={15} />{busy ? 'Writing' : 'Generate report'}</button></div>
      {!data.length ? <Empty title="No reports yet" /> : (
        <div className="space-y-4">{data.map((r) => { const d = r.data; return (
          <article key={r._id} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">Week of {fmtDate(d.period.start)}</h3><div className="flex gap-2">{r.auto && <Badge>Automatic</Badge>}<Badge className="bg-forest-light text-forest">{d.orders} orders</Badge></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard label="Revenue" value={money(d.revenue)} sub={d.growth !== null ? `${d.growth >= 0 ? '+' : ''}${d.growth}% vs the week before` : undefined} /><StatCard label="Average order" value={money(d.aov)} /><StatCard label="Rating" value={d.rating || '-'} /><StatCard label="Reviews" value={`${d.sentiment.positive} good, ${d.sentiment.negative} bad`} /></div>
            {d.narrative && <p className="mt-4 text-sm leading-relaxed">{d.narrative}</p>}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div><h4 className="mb-2 text-sm font-bold">Most profitable dishes</h4><ol className="space-y-1 text-sm">{d.topProfitable.map((p, i) => <li key={p.name} className="flex justify-between"><span>{i + 1}. {p.name}</span><span className="text-ink/60">{money(p.profit)}</span></li>)}</ol></div>
              <div><h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Lightbulb size={14} className="text-saffron-dark" />Tips for next week</h4><ul className="space-y-1.5 text-sm text-ink/80">{d.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />{t}</li>)}</ul></div>
            </div>
          </article>); })}</div>
      )}
    </>
  );
}

export default function AI() {
  const [tab, setTab] = useState('pricing');
  return (
    <>
      <PageHeader title="AI insights" sub="Smart pricing, review sentiment, profitability and weekly reports, all explained in plain language." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'pricing', label: 'Smart pricing' }, { id: 'sentiment', label: 'Review sentiment' }, { id: 'profit', label: 'Profitability' }, { id: 'reports', label: 'Weekly reports' }]} />
      {tab === 'pricing' ? <Pricing /> : tab === 'sentiment' ? <Sentiment /> : tab === 'profit' ? <Profit /> : <Reports />}
    </>
  );
}
