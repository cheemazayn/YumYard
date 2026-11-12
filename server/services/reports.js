const Report = require('./../models/Report');
const Restaurant = require('./../models/Restaurant');
const Order = require('./../models/Order');
const { profitability, sentimentSummary, inventoryForecast, pricingSuggestions, askClaude } = require('./ai');
const { notifyLeaders } = require('./notify');

const DAY = 864e5;

// Builds a weekly insight report with operational improvement tips
async function buildReport(rid, { auto = false } = {}) {
  const end = new Date();
  const start = new Date(+end - 7 * DAY);
  const prevStart = new Date(+start - 7 * DAY);
  const [cur, prev] = await Promise.all([
    Order.find({ restaurant: rid, status: { $nin: ['cancelled', 'rejected'] }, createdAt: { $gte: start } }).select('total').lean(),
    Order.find({ restaurant: rid, status: { $nin: ['cancelled', 'rejected'] }, createdAt: { $gte: prevStart, $lt: start } }).select('total').lean(),
  ]);
  const revenue = cur.reduce((s, o) => s + o.total, 0), prevRevenue = prev.reduce((s, o) => s + o.total, 0);
  const [profit, senti, stock, pricing] = await Promise.all([profitability(rid, null, 7), sentimentSummary(rid), inventoryForecast(rid), pricingSuggestions(rid)]);

  const tips = [];
  if (prevRevenue && revenue < prevRevenue * 0.9) tips.push(`Revenue is down ${Math.round((1 - revenue / prevRevenue) * 100)}% on last week. Launch a promotion in your quietest hours.`);
  if (prevRevenue && revenue > prevRevenue * 1.1) tips.push(`Revenue grew ${Math.round((revenue / prevRevenue - 1) * 100)}% on last week. Make sure your best sellers stay in stock.`);
  const worst = [...profit].reverse().find((p) => p.margin < 45);
  if (worst) tips.push(`${worst.name} earns only a ${worst.margin}% margin. Review its portion cost or raise the price slightly.`);
  const slow = pricing.suggestions.filter((s) => s.action === 'discount').slice(0, 2).map((s) => s.name);
  if (slow.length) tips.push(`Slow sellers: ${slow.join(', ')}. Bundle them with a best seller or discount them.`);
  if (stock.summary.critical) tips.push(`${stock.summary.critical} ingredient(s) are at critical level. Use the purchase list to reorder today.`);
  if (stock.summary.wasteCost30 > 0) tips.push(`You wrote off Rs ${stock.summary.wasteCost30.toLocaleString()} of stock in 30 days. Order smaller quantities of perishables.`);
  if (senti.alerts.length) tips.push(`${senti.alerts.length} negative review(s) still need a reply.`);
  const weak = senti.topics.map((t) => ({ ...t })).sort((a, b) => b.negative - a.negative)[0];
  if (weak && weak.negative > 1) tips.push(`Guests mention "${weak.topic}" most in negative reviews. Focus your next team briefing there.`);
  if (!tips.length) tips.push('Operations look steady this week. Keep monitoring the dashboard.');

  let narrative = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      narrative = await askClaude('You are a restaurant business analyst. Write a 4 sentence weekly summary for the owner in plain language.',
        JSON.stringify({ revenue, prevRevenue, orders: cur.length, top: profit.slice(0, 3), tips }), 260);
    } catch {}
  }
  const data = {
    period: { start, end }, revenue: Math.round(revenue), prevRevenue: Math.round(prevRevenue), orders: cur.length,
    growth: prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
    aov: cur.length ? Math.round(revenue / cur.length) : 0,
    topProfitable: profit.slice(0, 5), lowMargin: [...profit].reverse().slice(0, 3),
    rating: senti.avgRating, sentiment: senti.counts, tips, narrative,
  };
  const report = await Report.create({ restaurant: rid, weekStart: start, data, auto });
  if (auto) await notifyLeaders(rid, { type: 'weekly_report', message: 'Your weekly insight report is ready.', link: '/dashboard/ai' });
  return report;
}

// Runs on start-up and every few hours: any active restaurant without a report this week gets one
async function runWeeklyReports() {
  const restaurants = await Restaurant.find({ status: 'active' }).select('_id');
  for (const r of restaurants) {
    const last = await Report.findOne({ restaurant: r._id }).sort({ createdAt: -1 });
    if (!last || Date.now() - last.createdAt > 7 * DAY) await buildReport(r._id, { auto: true }).catch((e) => console.error('Report failed', e.message));
  }
}

module.exports = { buildReport, runWeeklyReports };
