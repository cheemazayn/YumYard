const Order = require('../models/Order');
const Review = require('../models/Review');
const InventoryItem = require('../models/InventoryItem');
const Payment = require('../models/Payment');

const DAY = 864e5;
const round = (n) => Math.round(n);
const DEAD = ['cancelled', 'rejected'];

const isDelayed = (o) => {
  if (DEAD.includes(o.status)) return false;
  const end = o.readyAt || o.deliveredAt || new Date();
  return new Date(end) - new Date(o.createdAt) > o.estimatedMinutes * 60000 * 1.25;
};

async function overview(rid, branchId, days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const q = { restaurant: rid, createdAt: { $gte: since } };
  if (branchId) q.branch = branchId;
  const orders = await Order.find(q).populate('branch', 'name').lean();
  const valid = orders.filter((o) => !DEAD.includes(o.status));

  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const byDayMap = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    byDayMap[d] = { date: d, revenue: 0, orders: 0 };
  }
  const branches = {}, items = {}, hours = Array(24).fill(0), status = {}, types = {};
  valid.forEach((o) => {
    const d = new Date(o.createdAt).toISOString().slice(0, 10);
    if (byDayMap[d]) { byDayMap[d].revenue += o.total; byDayMap[d].orders++; }
    const bn = o.branch?.name || 'Unknown';
    branches[bn] = branches[bn] || { name: bn, revenue: 0, orders: 0, delayed: 0 };
    branches[bn].revenue += o.total; branches[bn].orders++;
    if (isDelayed(o)) branches[bn].delayed++;
    o.items.forEach((i) => {
      items[i.name] = items[i.name] || { name: i.name, qty: 0, revenue: 0 };
      items[i.name].qty += i.qty; items[i.name].revenue += i.qty * i.price;
    });
    hours[new Date(o.createdAt).getHours()]++;
    types[o.type] = (types[o.type] || 0) + 1;
  });
  orders.forEach((o) => (status[o.status] = (status[o.status] || 0) + 1));

  // This week against last week, day by day
  const wk = { rows: [], thisWeek: 0, lastWeek: 0 };
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const wq = { restaurant: rid, createdAt: { $gte: new Date(startOfToday - 13 * DAY) }, status: { $nin: DEAD } };
  if (branchId) wq.branch = branchId;
  const recent = await Order.find(wq).select('total createdAt').lean();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(startOfToday - i * DAY), prev = new Date(startOfToday - (i + 7) * DAY);
    const inDay = (o, d) => new Date(o.createdAt) >= d && new Date(o.createdAt) < new Date(+d + DAY);
    const cur = recent.filter((o) => inDay(o, day)).reduce((s, o) => s + o.total, 0);
    const old = recent.filter((o) => inDay(o, prev)).reduce((s, o) => s + o.total, 0);
    wk.rows.push({ day: day.toLocaleDateString('en-US', { weekday: 'short' }), thisWeek: round(cur), lastWeek: round(old) });
    wk.thisWeek += cur; wk.lastWeek += old;
  }

  const rq = { restaurant: rid, createdAt: { $gte: since } };
  if (branchId) rq.branch = branchId;
  const reviews = await Review.find(rq).select('rating').lean();
  const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const invQ = { restaurant: rid };
  if (branchId) invQ.branch = branchId;
  const inv = await InventoryItem.find(invQ).select('quantity reorderLevel name unit branch costPerUnit wastageLogs').populate('branch', 'name').lean();
  const wastage = inv.reduce((s, it) => s + (it.wastageLogs || []).filter((l) => new Date(l.date) >= since).reduce((a, l) => a + l.qty * (it.costPerUnit || 0), 0), 0);
  const lowStock = inv.filter((i) => i.quantity <= i.reorderLevel).map((i) => ({ _id: i._id, name: i.name, quantity: i.quantity, unit: i.unit, reorderLevel: i.reorderLevel, branch: i.branch?.name }));

  const pq = { restaurant: rid, status: 'paid', paidAt: { $gte: since } };
  if (branchId) pq.branch = branchId;
  const pay = await Payment.aggregate([{ $match: { ...pq, restaurant: rid } }, { $group: { _id: '$method', value: { $sum: '$amount' } } }]);

  const today = byDayMap[new Date().toISOString().slice(0, 10)] || { revenue: 0, orders: 0 };
  return {
    days, revenue: round(revenue), orders: valid.length, avgOrder: valid.length ? round(revenue / valid.length) : 0,
    today: { revenue: round(today.revenue), orders: today.orders },
    delayed: valid.filter(isDelayed).length,
    activeNow: orders.filter((o) => ['pending', 'confirmed', 'in_kitchen', 'ready', 'out_for_delivery'].includes(o.status)).length,
    pendingNow: orders.filter((o) => o.status === 'pending').length,
    rating: Math.round(rating * 10) / 10, reviews: reviews.length, wastage: round(wastage), lowStock,
    byDay: Object.values(byDayMap), byBranch: Object.values(branches).sort((a, b) => b.revenue - a.revenue),
    topItems: Object.values(items).sort((a, b) => b.qty - a.qty).slice(0, 6),
    byHour: hours.map((n, h) => ({ hour: h, label: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`, orders: n })).filter((h) => h.hour >= 9),
    status: Object.entries(status).map(([name, value]) => ({ name, value })),
    types: Object.entries(types).map(([name, value]) => ({ name, value })),
    payments: pay.map((p) => ({ name: p._id, value: round(p.value) })),
    week: { rows: wk.rows, thisWeek: round(wk.thisWeek), lastWeek: round(wk.lastWeek), growth: wk.lastWeek ? Math.round(((wk.thisWeek - wk.lastWeek) / wk.lastWeek) * 100) : null },
  };
}

module.exports = { overview, isDelayed };
