// AI services for YumYard. Everything works with built-in NLP and statistics.
// ANTHROPIC_API_KEY upgrades sentiment analysis and review digests; OPENAI_API_KEY upgrades dish image generation.
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const InventoryItem = require('../models/InventoryItem');
const Review = require('../models/Review');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { round } = require('./util');

const DAY = 864e5;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const validOrders = { status: { $nin: ['cancelled', 'rejected'] } };

async function askClaude(system, user, maxTokens = 400) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  return data.content.map((c) => c.text || '').join('');
}

/* ---------------- Sentiment analysis (NLP) ---------------- */
const POSITIVE = ['great', 'amazing', 'delicious', 'tasty', 'excellent', 'fresh', 'love', 'loved', 'best', 'friendly', 'perfect', 'awesome', 'good', 'nice', 'fantastic', 'superb', 'yummy', 'clean', 'fast', 'quick', 'polite', 'wonderful', 'juicy', 'crispy', 'flavorful', 'recommend', 'worth'];
const NEGATIVE = ['bad', 'terrible', 'awful', 'worst', 'cold', 'stale', 'slow', 'late', 'delay', 'delayed', 'rude', 'dirty', 'bland', 'overpriced', 'expensive', 'disappointing', 'disappointed', 'raw', 'burnt', 'hair', 'poor', 'horrible', 'unhygienic', 'salty', 'soggy', 'waited', 'waiting', 'undercooked', 'greasy', 'missing', 'wrong'];
const NEGATORS = ['not', 'never', 'no', "isn't", "wasn't", "don't", "didn't", 'hardly', 'without'];
const TOPICS = {
  food: ['food', 'taste', 'tasty', 'flavor', 'flavorful', 'delicious', 'bland', 'salty', 'raw', 'burnt', 'stale', 'fresh', 'portion', 'pizza', 'burger', 'biryani', 'steak', 'dessert', 'cold', 'greasy', 'undercooked', 'soggy', 'juicy', 'crispy'],
  service: ['service', 'staff', 'waiter', 'waitress', 'rude', 'friendly', 'polite', 'manager', 'attitude', 'helpful'],
  speed: ['slow', 'fast', 'late', 'delay', 'delayed', 'wait', 'waited', 'waiting', 'quick', 'minutes', 'hour'],
  price: ['price', 'expensive', 'overpriced', 'cheap', 'value', 'worth', 'cost', 'bill'],
  cleanliness: ['clean', 'dirty', 'hygiene', 'hygienic', 'unhygienic', 'hair', 'smell'],
  ambience: ['ambience', 'ambiance', 'atmosphere', 'music', 'seating', 'decor', 'noise', 'noisy', 'cozy'],
};

function ruleSentiment(text = '', rating = 3) {
  const tokens = text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  let score = 0;
  tokens.forEach((tok, i) => {
    let v = POSITIVE.includes(tok) ? 1 : NEGATIVE.includes(tok) ? -1 : 0;
    if (!v) return;
    if (NEGATORS.includes(tokens[i - 1]) || NEGATORS.includes(tokens[i - 2])) v = -v;
    score += v;
  });
  score += (rating - 3) * 0.9;
  const norm = Math.tanh(score / 3);
  const topics = Object.entries(TOPICS).filter(([, w]) => tokens.some((t) => w.includes(t))).map(([k]) => k);
  return { label: norm > 0.2 ? 'positive' : norm < -0.2 ? 'negative' : 'neutral', score: round(norm, 2), topics, source: 'rules' };
}

async function analyzeSentiment(text, rating) {
  const fallback = ruleSentiment(text, rating);
  if (!process.env.ANTHROPIC_API_KEY || !text?.trim()) return fallback;
  try {
    const out = await askClaude(
      'You classify restaurant reviews. Reply with JSON only: {"label":"positive|neutral|negative","score":-1..1,"topics":["food"|"service"|"speed"|"price"|"cleanliness"|"ambience"]}',
      `Rating: ${rating}/5\nReview: ${text}`, 150);
    const p = JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
    if (!['positive', 'neutral', 'negative'].includes(p.label)) return fallback;
    return { label: p.label, score: Number(p.score) || 0, topics: (p.topics || []).filter((t) => TOPICS[t]), source: 'claude' };
  } catch { return fallback; }
}

async function sentimentSummary(rid, branchId) {
  const q = { restaurant: rid };
  if (branchId) q.branch = branchId;
  const reviews = await Review.find(q).sort({ createdAt: -1 }).limit(300).lean();
  const counts = { positive: 0, neutral: 0, negative: 0 };
  const topics = {};
  reviews.forEach((r) => {
    counts[r.sentiment?.label || 'neutral']++;
    (r.sentiment?.topics || []).forEach((t) => {
      topics[t] = topics[t] || { topic: t, positive: 0, neutral: 0, negative: 0 };
      topics[t][r.sentiment.label]++;
    });
  });
  const weeks = Array.from({ length: 8 }, (_, i) => ({ week: `W-${7 - i}`, score: 0, n: 0 }));
  reviews.forEach((r) => {
    const w = Math.floor((Date.now() - new Date(r.createdAt)) / (7 * DAY));
    if (w < 8) { weeks[7 - w].score += r.sentiment?.score || 0; weeks[7 - w].n++; }
  });
  const trend = weeks.map((w) => ({ week: w.week, score: w.n ? round(w.score / w.n, 2) : null, reviews: w.n }));
  const alerts = reviews.filter((r) => r.sentiment?.label === 'negative' && !r.reply && Date.now() - new Date(r.createdAt) < 7 * DAY);
  const avgRating = reviews.length ? round(sum(reviews.map((r) => r.rating)) / reviews.length, 1) : 0;
  let digest = null;
  if (process.env.ANTHROPIC_API_KEY && reviews.length) {
    try {
      digest = await askClaude('You write a 3 sentence plain-language digest of restaurant feedback for the manager. Say what to fix first.',
        reviews.slice(0, 40).map((r) => `${r.rating}/5 ${r.comment}`).join('\n'), 220);
    } catch {}
  }
  return { total: reviews.length, avgRating, counts, topics: Object.values(topics), trend, alerts, digest };
}

/* ---------------- Smart menu pricing ---------------- */
async function pricingSuggestions(rid, branchId) {
  const since = new Date(Date.now() - 30 * DAY);
  const q = { restaurant: rid, ...validOrders, createdAt: { $gte: since } };
  if (branchId) q.branch = branchId;
  const orders = await Order.find(q).lean();
  const qty = {};
  const hours = Array(24).fill(0);
  orders.forEach((o) => {
    hours[new Date(o.createdAt).getHours()]++;
    o.items.forEach((i) => (qty[i.menuItem] = (qty[i.menuItem] || 0) + i.qty));
  });

  const iq = { restaurant: rid, available: true };
  if (branchId) iq.branch = branchId;
  const items = await MenuItem.find(iq).populate('branch', 'name').lean();
  const avg = items.length ? sum(items.map((i) => qty[i._id] || 0)) / items.length : 0;

  const suggestions = items.map((it) => {
    const sold = qty[it._id] || 0;
    const ratio = avg ? sold / avg : 1;
    let action = 'hold', pct = 0;
    let reason = `Selling in line with the rest of the menu (${sold} portions in 30 days).`;
    if (ratio < 0.2) { action = 'discount'; pct = -15; reason = `Only ${sold} sold in 30 days, far below the menu average of ${round(avg)}. A 15% offer should help clear it.`; }
    else if (ratio < 0.5) { action = 'discount'; pct = -10; reason = `${sold} sold in 30 days against a menu average of ${round(avg)}. Promote it with a 10% offer.`; }
    else if (ratio > 1.7) { action = 'increase'; pct = 5; reason = `Best seller with ${sold} portions in 30 days, ${round(ratio, 1)}x the menu average. Demand supports a small rise.`; }
    const suggestedPrice = round(it.basePrice * (1 + pct / 100));
    return {
      itemId: it._id, name: it.name, branch: it.branch?.name, image: it.image,
      basePrice: it.basePrice, currentPrice: it.price, suggestedPrice, change: pct, action, sold, reason,
      applied: action !== 'hold' && it.price === suggestedPrice,
    };
  });

  const ranked = hours.map((n, h) => ({ hour: h, orders: n })).filter((h) => h.hour >= 9 && h.hour <= 23);
  const busiest = [...ranked].sort((a, b) => b.orders - a.orders).slice(0, 3);
  const active = ranked.filter((h) => h.orders > 0);
  const avgHour = active.length ? sum(active.map((h) => h.orders)) / active.length : 0;
  const peakHours = busiest.filter((h) => h.orders > 0).map((h) => h.hour).sort((a, b) => a - b);
  const slowHours = [...ranked].filter((h) => h.hour >= 11 && h.hour <= 22).sort((a, b) => a.orders - b.orders).slice(0, 3).map((h) => h.hour).sort((a, b) => a - b);
  const peakAvg = peakHours.length ? sum(busiest.map((h) => h.orders)) / busiest.length : 0;
  const restaurant = await Restaurant.findById(rid).select('surge').lean();
  const surge = {
    current: restaurant?.surge || { enabled: false, pct: 0, hours: [] },
    suggestion: avgHour && peakAvg >= avgHour * 1.5 ? {
      pct: peakAvg >= avgHour * 2.2 ? 10 : 6, hours: peakHours,
      reason: `Traffic in these hours runs ${round(peakAvg / avgHour, 1)}x the hourly average. A small peak-hour uplift protects service quality.`,
    } : null,
  };
  return { suggestions: suggestions.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)), peakHours, slowHours, surge, ordersAnalysed: orders.length };
}

/* ---------------- Profitability ranking ---------------- */
async function profitability(rid, branchId, days = 30) {
  const q = { restaurant: rid, ...validOrders, createdAt: { $gte: new Date(Date.now() - days * DAY) } };
  if (branchId) q.branch = branchId;
  const orders = await Order.find(q).select('items').lean();
  const agg = {};
  orders.forEach((o) => o.items.forEach((i) => {
    const a = (agg[i.name] = agg[i.name] || { name: i.name, id: String(i.menuItem), qty: 0, revenue: 0 });
    a.qty += i.qty; a.revenue += i.qty * i.price;
  }));
  const items = await MenuItem.find({ _id: { $in: Object.values(agg).map((a) => a.id) } }).select('cost basePrice').lean();
  const rows = Object.values(agg).map((a) => {
    const m = items.find((x) => String(x._id) === a.id);
    const cost = m?.cost > 0 ? m.cost : (m?.basePrice || 0) * 0.4; // assume 40% food cost when not set
    const profit = a.revenue - cost * a.qty;
    return { name: a.name, qty: a.qty, revenue: Math.round(a.revenue), profit: Math.round(profit), margin: a.revenue ? Math.round((profit / a.revenue) * 100) : 0 };
  });
  return rows.sort((a, b) => b.profit - a.profit);
}

/* ---------------- Inventory predictor ---------------- */
const HOLIDAYS = { '03-23': 'Pakistan Day', '05-01': 'Labour Day', '08-14': 'Independence Day', '11-09': 'Iqbal Day', '12-25': 'Quaid-e-Azam Day' };
const holidayOf = (d) => HOLIDAYS[`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`];
const WEEKEND = [5, 6, 0]; // Fri, Sat, Sun are the busy days

async function inventoryForecast(rid, branchId) {
  const q = { restaurant: rid };
  if (branchId) q.branch = branchId;
  const items = await InventoryItem.find(q).populate('branch', 'name').populate('supplier', 'name').lean();
  const N = 14;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const rows = items.map((it) => {
    const daily = Array(N).fill(0);
    const byDow = Array(7).fill(0), dowDays = Array(7).fill(0);
    (it.usageLogs || []).forEach((l) => {
      const dt = new Date(l.date);
      const d = Math.floor((today - new Date(dt).setHours(0, 0, 0, 0)) / DAY);
      if (d >= 0 && d < N) daily[N - 1 - d] += l.qty;
      if (d >= 0 && d < 28) byDow[dt.getDay()] += l.qty;
    });
    for (let d = 0; d < 28; d++) dowDays[new Date(today - d * DAY).getDay()]++;
    const total28 = sum(byDow);
    const overall = total28 / 28;
    const dowFactor = byDow.map((v, i) => (overall > 0 && dowDays[i] ? Math.min(1.8, Math.max(0.6, v / dowDays[i] / overall)) : 1));

    // Weighted moving average of the last 14 days (recent days count more) and a simple trend
    const w = daily.map((_, i) => i + 1);
    const wma = sum(daily.map((v, i) => v * w[i])) / sum(w);
    const xm = (N - 1) / 2, ym = sum(daily) / N;
    const denom = sum(daily.map((_, i) => (i - xm) ** 2));
    const slope = denom ? sum(daily.map((v, i) => (i - xm) * (v - ym))) / denom : 0;

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() + (i + 1) * DAY);
      const hol = holidayOf(d);
      const value = Math.max(0, (wma + slope * (i + 1) * 0.5) * dowFactor[d.getDay()] * (hol ? 1.25 : 1));
      return { date: d.toISOString().slice(0, 10), dow: d.getDay(), holiday: hol || null, value: round(value, 2) };
    });
    const need7 = sum(days.map((d) => d.value));
    const weekendNeed = sum(days.filter((d) => WEEKEND.includes(d.dow) || d.holiday).map((d) => d.value));
    const daysLeft = wma > 0 ? it.quantity / wma : null;
    const reorder = Math.max(0, Math.ceil(need7 * 1.15 - it.quantity));
    const wasted30 = sum((it.wastageLogs || []).filter((l) => Date.now() - new Date(l.date) < 30 * DAY).map((l) => l.qty));

    let status = 'ok';
    if (it.quantity <= it.reorderLevel || (daysLeft !== null && daysLeft < 2)) status = 'critical';
    else if (daysLeft !== null && daysLeft < 4) status = 'low';
    else if (it.perishable && daysLeft !== null && daysLeft > 25) status = 'overstock';

    let advice = 'Stock level is healthy for the coming week.';
    if (status === 'critical') advice = `Runs out in about ${daysLeft !== null ? round(daysLeft, 1) : 'a few'} days. Order ${reorder} ${it.unit} now.`;
    if (status === 'low') advice = `About ${round(daysLeft, 1)} days of stock left. Plan an order of ${reorder} ${it.unit}.`;
    if (status === 'overstock') advice = `Holds ${round(daysLeft)} days of stock. Perishable items may spoil, so hold off on ordering.`;

    return {
      _id: it._id, name: it.name, unit: it.unit, branch: it.branch?.name, branchId: it.branch?._id,
      supplier: it.supplier?.name, supplierId: it.supplier?._id, costPerUnit: it.costPerUnit,
      quantity: it.quantity, reorderLevel: it.reorderLevel, avgDaily: round(wma, 2),
      daysLeft: daysLeft === null ? null : round(daysLeft, 1), days, need7: round(need7, 1), weekendNeed: round(weekendNeed, 1),
      reorder, status, advice, wasted30, wasteCost: round(wasted30 * (it.costPerUnit || 0)),
    };
  });

  const order = { critical: 0, low: 1, overstock: 2, ok: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status]);
  const totalNext7 = Array.from({ length: 7 }, (_, i) => ({
    date: rows[0]?.days[i].date || '', holiday: rows[0]?.days[i].holiday || null, value: round(sum(rows.map((r) => r.days[i].value)), 1),
  }));
  const nextHoliday = totalNext7.find((d) => d.holiday);
  return {
    items: rows,
    purchaseList: rows.filter((r) => r.reorder > 0).map((r) => ({ id: r._id, name: r.name, branch: r.branch, branchId: r.branchId, supplier: r.supplier || 'No supplier', supplierId: r.supplierId, qty: r.reorder, unit: r.unit, cost: round(r.reorder * (r.costPerUnit || 0)) })),
    summary: {
      critical: rows.filter((r) => r.status === 'critical').length, low: rows.filter((r) => r.status === 'low').length,
      overstock: rows.filter((r) => r.status === 'overstock').length, wasteCost30: sum(rows.map((r) => r.wasteCost)),
    },
    totalNext7,
    upcoming: { holiday: nextHoliday ? { name: nextHoliday.holiday, date: nextHoliday.date } : null },
  };
}

/* ---------------- Image generator ---------------- */
async function generateImage(name, description = '') {
  const prompt = `Professional food photography of ${name}. ${description}. Beautifully plated, natural window light, shallow depth of field, restaurant menu photo, no text`;
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt, size: '1024x1024', n: 1 }),
      });
      const data = await res.json();
      // OpenAI image links expire after about an hour, so save the result to your own storage for production.
      if (data.data?.[0]?.url) return { url: data.data[0].url, provider: 'openai' };
    } catch {}
  }
  const seed = Math.floor(Math.random() * 1e6);
  return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=600&nologo=true&seed=${seed}`, provider: 'pollinations' };
}

/* ---------------- Recommendation engine ---------------- */
async function recommend(rid, branchId, itemIds = [], userId = null, limit = 4) {
  const ids = itemIds.map(String);
  const oq = { restaurant: rid, ...validOrders };
  if (branchId) oq.branch = branchId;
  const orders = await Order.find(oq).sort({ createdAt: -1 }).limit(600).select('items.menuItem customer').lean();
  const pop = {}, co = {}, mine = {};
  orders.forEach((o) => {
    const inOrder = o.items.map((i) => String(i.menuItem));
    inOrder.forEach((a) => {
      pop[a] = (pop[a] || 0) + 1;
      if (ids.includes(a)) inOrder.forEach((b) => { if (!ids.includes(b)) co[b] = (co[b] || 0) + 1; });
      if (userId && String(o.customer) === String(userId)) mine[a] = (mine[a] || 0) + 1;
    });
  });

  let reason = 'Popular right now';
  const score = {};
  const add = (map, weight) => Object.entries(map).forEach(([k, v]) => { if (!ids.includes(k)) score[k] = (score[k] || 0) + v * weight; });
  if (ids.length && Object.keys(co).length) { add(co, 3); reason = 'Frequently bought together'; }
  if (userId) {
    const user = await User.findById(userId).select('browsing').lean();
    const browse = {};
    (user?.browsing || []).forEach((b) => (browse[String(b)] = (browse[String(b)] || 0) + 1));
    if (Object.keys(mine).length || Object.keys(browse).length) {
      add(mine, 2); add(browse, 1.5);
      if (!ids.length) reason = 'Suggested for you';
    }
    // Same category and dietary tags as their past orders
    const favIds = Object.keys(mine);
    if (favIds.length) {
      const favs = await MenuItem.find({ _id: { $in: favIds } }).select('category dietaryTags').lean();
      const cats = new Set(favs.map((f) => String(f.category)));
      const tags = new Set(favs.flatMap((f) => f.dietaryTags));
      const pool = await MenuItem.find({ restaurant: rid, ...(branchId ? { branch: branchId } : {}), available: true }).select('category dietaryTags').lean();
      pool.forEach((p) => {
        const k = String(p._id);
        if (ids.includes(k) || mine[k]) return;
        score[k] = (score[k] || 0) + (cats.has(String(p.category)) ? 1.2 : 0) + p.dietaryTags.filter((t) => tags.has(t)).length * 0.4;
      });
    }
  }
  add(pop, 0.15); // best sellers fill any gaps (also the answer for new users)
  const top = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, limit + 4);
  const found = await MenuItem.find({ _id: { $in: top }, restaurant: rid, available: true, ...(branchId ? { branch: branchId } : {}) }).lean();
  const items = top.map((id) => found.find((i) => String(i._id) === id)).filter(Boolean).slice(0, limit);
  return { reason, items };
}

/* ---------------- Manager insights ---------------- */
async function insights(rid, branchId) {
  const [pricing, stock, senti] = await Promise.all([pricingSuggestions(rid, branchId), inventoryForecast(rid, branchId), sentimentSummary(rid, branchId)]);
  const out = [];
  const crit = stock.items.filter((i) => i.status === 'critical');
  if (crit.length) out.push({ tone: 'danger', title: `${crit.length} ingredient${crit.length > 1 ? 's' : ''} about to run out`, text: crit.slice(0, 3).map((c) => `${c.name} (${c.branch})`).join(', '), link: '/dashboard/inventory' });
  const slow = pricing.suggestions.filter((s) => s.action === 'discount' && !s.applied);
  if (slow.length) out.push({ tone: 'warn', title: `${slow.length} slow-selling dish${slow.length > 1 ? 'es' : ''} could use an offer`, text: slow.slice(0, 3).map((s) => s.name).join(', '), link: '/dashboard/ai' });
  if (senti.alerts.length) out.push({ tone: 'danger', title: `${senti.alerts.length} unanswered negative review${senti.alerts.length > 1 ? 's' : ''}`, text: 'Reply within a day to win the guest back.', link: '/dashboard/reviews' });
  if (stock.summary.wasteCost30 > 0) out.push({ tone: 'warn', title: `Rs ${stock.summary.wasteCost30.toLocaleString()} of stock wasted in 30 days`, text: 'Check the overstock list to avoid over-ordering.', link: '/dashboard/inventory' });
  if (pricing.surge.suggestion && !pricing.surge.current.enabled) out.push({ tone: 'info', title: 'Peak-hour pricing suggestion', text: pricing.surge.suggestion.reason, link: '/dashboard/ai' });
  const best = pricing.suggestions.find((s) => s.action === 'increase');
  if (best) out.push({ tone: 'good', title: `${best.name} is your top performer`, text: `Consider a price of Rs ${best.suggestedPrice}.`, link: '/dashboard/ai' });
  if (stock.upcoming.holiday) out.push({ tone: 'info', title: `${stock.upcoming.holiday.name} is coming up`, text: 'Forecasts already include a holiday uplift. Review the purchase list.', link: '/dashboard/inventory' });
  if (pricing.slowHours.length) out.push({ tone: 'info', title: 'Quietest hours', text: `Try a happy-hour deal around ${pricing.slowHours.map((h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`).join(', ')}.`, link: '/dashboard/promotions' });
  return out;
}

module.exports = { analyzeSentiment, sentimentSummary, pricingSuggestions, profitability, inventoryForecast, generateImage, recommend, insights, ruleSentiment, askClaude };
