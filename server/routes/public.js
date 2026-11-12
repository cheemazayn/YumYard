const router = require('express').Router();
const Restaurant = require('../models/Restaurant');
const Branch = require('../models/Branch');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const GameScore = require('../models/GameScore');
const User = require('../models/User');
const { optionalAuth, protect } = require('../middleware/auth');
const { createOrder, setStatus, priceCoupon } = require('../services/orders');
const { analyzeSentiment, recommend } = require('../services/ai');
const { effectivePrice, surgeActive } = require('../services/pricing');
const { getSettings } = require('../services/settings');
const { httpError } = require('../services/util');

const luhn = (num) => {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) { let n = +num[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
};

async function liveRestaurant(slug) {
  const r = await Restaurant.findOne({ slug });
  if (!r || r.status !== 'active' || !r.isPublished) throw httpError(404, 'We could not find this restaurant.');
  if (r.isExpired()) throw httpError(410, 'This restaurant is not taking online orders right now.');
  return r;
}

// Directory of live restaurants
router.get('/restaurants', async (req, res) => {
  const list = await Restaurant.find({ status: 'active', isPublished: true }).select('name slug tagline cuisine cover logo plan theme').lean();
  const live = list.filter((r) => r.plan.status === 'active' || (r.plan.status === 'trial' && new Date(r.plan.trialEndsAt) > new Date()));
  const [ratings, branches] = await Promise.all([
    Review.aggregate([{ $group: { _id: '$restaurant', total: { $sum: '$rating' }, n: { $sum: 1 } } }]),
    Branch.aggregate([{ $group: { _id: '$restaurant', n: { $sum: 1 } } }]),
  ]);
  res.json(live.map(({ plan, ...r }) => ({
    ...r,
    rating: (() => { const x = ratings.find((y) => String(y._id) === String(r._id)); return x ? Math.round((x.total / x.n) * 10) / 10 : 0; })(),
    branches: branches.find((x) => String(x._id) === String(r._id))?.n || 1,
  })));
});

// The generated restaurant website: details, branches, the chosen branch's menu and reviews
router.get('/restaurants/:slug', async (req, res) => {
  const r = await liveRestaurant(req.params.slug);
  const branches = await Branch.find({ restaurant: r._id, isActive: true }).lean();
  const branch = branches.find((b) => String(b._id) === req.query.branch) || branches[0];
  const [categories, items, reviews, agg] = await Promise.all([
    branch ? Category.find({ restaurant: r._id, branch: branch._id }).sort({ sort: 1, name: 1 }).lean() : [],
    branch ? MenuItem.find({ restaurant: r._id, branch: branch._id, available: true }).select('-recipe -cost').sort({ name: 1 }).lean() : [],
    Review.find({ restaurant: r._id, rating: { $gte: 4 }, comment: { $ne: '' } }).sort({ createdAt: -1 }).limit(6).lean(),
    Review.aggregate([{ $match: { restaurant: r._id } }, { $group: { _id: null, total: { $sum: '$rating' }, n: { $sum: 1 } } }]),
  ]);
  const now = new Date();
  const { owner, documents, rejectionReason, ...safe } = r.toObject();
  res.json({
    restaurant: safe, branches, branch: branch?._id, categories,
    menu: items.map((i) => ({ ...i, livePrice: effectivePrice(i, r, now) })),
    surge: surgeActive(r, now) ? { pct: r.surge.pct } : null,
    reviews, rating: { avg: agg[0] ? Math.round((agg[0].total / agg[0].n) * 10) / 10 : 0, count: agg[0]?.n || 0 },
    settings: await getSettings().then((s) => ({ taxRate: s.taxRate, serviceFee: s.serviceFee })),
  });
});

// Remembers what a signed-in customer looked at (feeds the recommendation engine)
router.post('/track', optionalAuth, async (req, res) => {
  if (req.user && req.body.itemId) {
    await User.updateOne({ _id: req.user._id }, { $push: { browsing: { $each: [req.body.itemId], $slice: -40 } } });
  }
  res.json({ ok: true });
});

router.get('/restaurants/:slug/recommend', optionalAuth, async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.params.slug, status: 'active' }).select('_id');
  if (!r) return res.json({ reason: '', items: [] });
  const ids = (req.query.items || '').split(',').filter(Boolean);
  const out = await recommend(r._id, req.query.branch || null, ids, req.user?._id);
  res.json({ reason: out.reason, items: out.items.map(({ recipe, cost, ...i }) => i) });
});

router.post('/coupons/validate', async (req, res) => {
  const { slug, branch, code, subtotal } = req.body;
  const r = await Restaurant.findOne({ slug }).select('_id');
  if (!r) throw httpError(404, 'Restaurant not found.');
  const { discount, coupon } = await priceCoupon(r._id, branch, code, Number(subtotal) || 0);
  res.json({ discount, code: coupon?.code, description: coupon?.description });
});

// Place an order (guests allowed)
router.post('/orders', optionalAuth, async (req, res) => {
  const { slug, card, ...body } = req.body;
  const r = await liveRestaurant(slug);
  if (!body.customerName?.trim() || !body.phone?.trim()) throw httpError(400, 'Please add your name and phone number.');
  if (body.type === 'delivery' && !body.address?.trim()) throw httpError(400, 'A delivery address is required.');
  if (body.type === 'dine-in' && !body.tableNo?.trim()) throw httpError(400, 'Please enter your table number.');
  if (body.paymentMethod === 'card') {
    const n = (card?.number || '').replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(n) || !luhn(n)) throw httpError(400, 'That card number is not valid.');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card?.expiry || '')) throw httpError(400, 'Enter the card expiry as MM/YY.');
    if (!/^\d{3,4}$/.test(card?.cvv || '')) throw httpError(400, 'Enter the 3 or 4 digit security code.');
    body.reference = `CARD-${n.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
  }
  const order = await createOrder({ ...body, restaurantId: r._id, customer: req.user?._id, source: 'website' }, req.app.get('io'));
  res.status(201).json(order);
});

// Live tracking (the order id acts as the tracking link)
router.get('/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id).populate('branch', 'name address phone').populate('restaurant', 'name slug theme template').lean();
  if (!order) throw httpError(404, 'Order not found.');
  res.json({ ...order, serverNow: Date.now() });
});

router.post('/orders/:id/cancel', optionalAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found.');
  if (order.customer && String(order.customer) !== String(req.user?._id)) throw httpError(403, 'This order belongs to another account.');
  if (order.status !== 'pending') throw httpError(400, 'The restaurant has already accepted this order, so it cannot be cancelled.');
  await setStatus(order, 'cancelled', req.app.get('io'), { reason: 'Cancelled by customer' });
  res.json(order);
});

// Mini-game result: awards points, and a small discount code for a great score
router.post('/orders/:id/game', optionalAuth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found.');
  if (!['pending', 'confirmed', 'in_kitchen', 'ready', 'out_for_delivery'].includes(order.status)) throw httpError(400, 'This order is complete, so the games are closed.');
  const plays = await GameScore.countDocuments({ order: order._id });
  if (plays >= 5) throw httpError(400, 'You have reached the game limit for this order.');
  const score = Math.max(0, Math.min(100, Math.round(Number(req.body.score) || 0)));
  const points = Math.min(50, Math.round(score / 2));
  const remaining = Math.max(0, Math.round((new Date(order.createdAt).getTime() + order.estimatedMinutes * 60000 - Date.now()) / 1000));

  let reward = null;
  const already = await GameScore.findOne({ order: order._id, reward: { $exists: true, $ne: null } });
  if (score >= 80 && !already) {
    const code = 'PLAY' + Math.random().toString(36).slice(2, 6).toUpperCase();
    await Coupon.create({ restaurant: order.restaurant, code, description: 'Earned playing while you waited', type: 'percent', value: 5, usageLimit: 1, expiresAt: new Date(Date.now() + 7 * 864e5), source: 'game' });
    reward = { code, value: 5 };
  }
  await GameScore.create({ restaurant: order.restaurant, order: order._id, customer: req.user?._id || order.customer, game: req.body.game, score, points, waitTimer: remaining, reward: reward?.code });
  let total = null;
  if (req.user) { const u = await User.findByIdAndUpdate(req.user._id, { $inc: { points } }, { new: true }); total = u.points; }
  res.json({ score, points, totalPoints: total, reward, waitTimer: remaining });
});

// Rating and review once the order is complete
router.post('/reviews', optionalAuth, async (req, res) => {
  const { orderId, rating, comment, name } = req.body;
  const order = await Order.findById(orderId);
  if (!order) throw httpError(404, 'Order not found.');
  if (order.status !== 'delivered') throw httpError(400, 'You can review an order once it has been completed.');
  if (order.reviewed) throw httpError(400, 'You have already reviewed this order.');
  if (!rating || rating < 1 || rating > 5) throw httpError(400, 'Please choose a star rating.');
  const sentiment = await analyzeSentiment(comment, rating);
  const review = await Review.create({
    restaurant: order.restaurant, branch: order.branch, order: order._id, customer: req.user?._id || order.customer,
    name: name || order.customerName, rating, comment: (comment || '').slice(0, 1000), sentiment,
  });
  order.reviewed = true; await order.save();
  req.app.get('io')?.to(`restaurant:${order.restaurant}`).emit('review:new', { rating, label: sentiment.label });
  res.status(201).json(review);
});

// Signed-in customers
router.get('/my-orders', protect, async (req, res) => {
  res.json(await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50).populate('restaurant', 'name slug').lean());
});

// 100 points buys a 10% code at a restaurant
router.post('/redeem', protect, async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.body.slug, status: 'active' });
  if (!r) throw httpError(404, 'Restaurant not found.');
  const user = await User.findById(req.user._id);
  if (user.points < 100) throw httpError(400, 'You need 100 points to redeem a discount.');
  user.points -= 100; await user.save();
  const code = 'YUM' + Math.random().toString(36).slice(2, 6).toUpperCase();
  await Coupon.create({ restaurant: r._id, code, description: 'Redeemed with game points', type: 'percent', value: 10, usageLimit: 1, expiresAt: new Date(Date.now() + 14 * 864e5), source: 'game' });
  res.json({ code, value: 10, points: user.points });
});

module.exports = router;
