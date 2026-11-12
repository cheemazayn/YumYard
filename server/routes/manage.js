const router = require('express').Router();
const Restaurant = require('../models/Restaurant');
const Branch = require('../models/Branch');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const InventoryItem = require('../models/InventoryItem');
const Supplier = require('../models/Supplier');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const Report = require('../models/Report');
const User = require('../models/User');
const { protect, allow, restaurantContext } = require('../middleware/auth');
const { createOrder, setStatus, recordPayment } = require('../services/orders');
const { overview } = require('../services/analytics');
const { buildReport } = require('../services/reports');
const { checkLowStock } = require('../services/notify');
const { getSettings } = require('../services/settings');
const { logActivity } = require('../services/activity');
const { httpError, slugify, escapeRegex } = require('../services/util');
const ai = require('../services/ai');

router.use(protect, allow('owner', 'manager', 'staff'), restaurantContext);

const leads = allow('owner', 'manager');
const ownerOnly = allow('owner');
const scope = (req, extra = {}) => ({ restaurant: req.rid, ...(req.branchId ? { branch: req.branchId } : {}), ...extra });

// The branch a menu or POS action applies to
async function pickBranch(req) {
  const wanted = req.user.role === 'staff' ? req.user.branch : req.query.branch || req.body?.branch || req.body?.branchId;
  if (wanted) {
    const b = await Branch.findOne({ _id: wanted, restaurant: req.rid });
    if (!b) throw httpError(400, 'That branch does not belong to your restaurant.');
    return b._id;
  }
  const first = await Branch.findOne({ restaurant: req.rid }).sort({ createdAt: 1 });
  if (!first) throw httpError(400, 'Add a branch first.');
  return first._id;
}
const num = (v, msg) => { const n = Number(v); if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < 0) throw httpError(400, msg); return n; };

/* ---------------- Business profile and website ---------------- */
router.get('/restaurant', (req, res) => res.json(req.restaurant));

router.put('/restaurant', leads, async (req, res) => {
  const fields = ['name', 'tagline', 'about', 'cuisine', 'logo', 'cover', 'gallery', 'template', 'theme', 'phone', 'email', 'openingHours', 'social', 'isPublished'];
  fields.forEach((k) => req.body[k] !== undefined && (req.restaurant[k] = req.body[k]));
  if (!req.restaurant.name?.trim()) throw httpError(400, 'Restaurant name cannot be empty.');
  await req.restaurant.save();
  logActivity(req, 'business profile updated', req.restaurant.name);
  res.json(req.restaurant);
});

router.get('/slug-check', async (req, res) => {
  const slug = slugify(req.query.slug || '');
  if (!slug) throw httpError(400, 'Enter a URL name.');
  const taken = await Restaurant.findOne({ slug, _id: { $ne: req.rid } });
  let suggestion = null;
  if (taken) { let i = 2; while (await Restaurant.findOne({ slug: `${slug}-${i}` })) i++; suggestion = `${slug}-${i}`; }
  res.json({ slug, available: !taken, suggestion });
});
router.put('/restaurant/slug', ownerOnly, async (req, res) => {
  const slug = slugify(req.body.slug || '');
  if (!slug) throw httpError(400, 'Enter a URL name.');
  if (await Restaurant.findOne({ slug, _id: { $ne: req.rid } })) throw httpError(409, 'That URL is taken.');
  req.restaurant.slug = slug; await req.restaurant.save();
  res.json(req.restaurant);
});
router.post('/restaurant/activate', ownerOnly, async (req, res) => {
  // A payment gateway would be called here. For the FYP demo the subscription is activated directly.
  req.restaurant.plan = { status: 'active', activatedAt: new Date() };
  await req.restaurant.save();
  logActivity(req, 'subscription activated', req.restaurant.name);
  res.json(req.restaurant);
});

/* ---------------- Branches ---------------- */
router.get('/branches', async (req, res) => {
  const q = { restaurant: req.rid };
  if (req.user.role === 'staff') q._id = req.user.branch;
  const branches = await Branch.find(q).sort({ createdAt: 1 }).lean();
  const stats = await Order.aggregate([
    { $match: { restaurant: req.rid, status: { $nin: ['cancelled', 'rejected'] }, createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } } },
    { $group: { _id: '$branch', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);
  res.json(branches.map((b) => ({ ...b, ...(stats.find((s) => String(s._id) === String(b._id)) || { revenue: 0, orders: 0 }) })));
});
const branchBody = (b) => ({
  name: b.name?.trim(), address: b.address?.trim(), city: b.city, phone: b.phone, operatingHours: b.operatingHours, isActive: b.isActive,
  geo: b.geo && Number.isFinite(Number(b.geo.lat)) && Number.isFinite(Number(b.geo.lng)) ? { lat: Number(b.geo.lat), lng: Number(b.geo.lng) } : undefined,
});
router.post('/branches', ownerOnly, async (req, res) => {
  const body = branchBody(req.body);
  if (!body.name || !body.address) throw httpError(400, 'Branch name and address are required.');
  if (await Branch.findOne({ restaurant: req.rid, name: new RegExp(`^${escapeRegex(body.name)}$`, 'i') }))
    throw httpError(409, 'A branch with this name already exists. Add a location identifier, for example "Gulberg".');
  const b = await Branch.create({ ...body, restaurant: req.rid });
  logActivity(req, 'branch created', body.name);
  res.status(201).json(b);
});
router.put('/branches/:id', leads, async (req, res) => {
  const body = branchBody(req.body);
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
  const b = await Branch.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, body, { new: true });
  b ? res.json(b) : res.status(404).json({ message: 'Branch not found.' });
});
router.delete('/branches/:id', ownerOnly, async (req, res) => {
  if ((await Branch.countDocuments({ restaurant: req.rid })) <= 1) throw httpError(400, 'You need at least one branch.');
  await Promise.all([
    Branch.deleteOne({ _id: req.params.id, restaurant: req.rid }), Category.deleteMany({ branch: req.params.id }),
    MenuItem.deleteMany({ branch: req.params.id }), InventoryItem.deleteMany({ branch: req.params.id }),
  ]);
  logActivity(req, 'branch deleted', req.params.id);
  res.json({ ok: true });
});

/* ---------------- Menu (each branch has its own menu) ---------------- */
router.get('/menu', async (req, res) => {
  const branch = await pickBranch(req);
  const [categories, items] = await Promise.all([
    Category.find({ restaurant: req.rid, branch }).sort({ sort: 1, name: 1 }).lean(),
    MenuItem.find({ restaurant: req.rid, branch }).sort({ name: 1 }).lean(),
  ]);
  res.json({ branch, categories, items });
});
router.post('/categories', leads, async (req, res) => {
  const branch = await pickBranch(req);
  if (!req.body.name?.trim()) throw httpError(400, 'Enter a category name.');
  const count = await Category.countDocuments({ restaurant: req.rid, branch });
  res.status(201).json(await Category.create({ restaurant: req.rid, branch, name: req.body.name.trim(), sort: count }));
});
router.put('/categories/:id', leads, async (req, res) => {
  res.json(await Category.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, { name: req.body.name?.trim() }, { new: true }));
});
router.delete('/categories/:id', leads, async (req, res) => {
  if (await MenuItem.countDocuments({ category: req.params.id })) throw httpError(400, 'Move or delete the items in this category first.');
  await Category.deleteOne({ _id: req.params.id, restaurant: req.rid });
  res.json({ ok: true });
});

const TAGS = ['halal', 'veg', 'vegan', 'gluten-free', 'spicy'];
const itemBody = (b) => ({
  name: b.name?.trim(), description: b.description, category: b.category, image: b.image,
  dietaryTags: (b.dietaryTags || []).filter((t) => TAGS.includes(t)),
  prepMinutes: Math.max(1, Number(b.prepMinutes) || 15),
  recipe: (b.recipe || []).filter((r) => r.name?.trim() && Number(r.qty) > 0).map((r) => ({ name: r.name.trim(), qty: Number(r.qty) })),
});
router.post('/menu', leads, async (req, res) => {
  const branch = await pickBranch(req);
  const body = itemBody(req.body);
  if (!body.name) throw httpError(400, 'Enter the dish name.');
  if (!(await Category.findOne({ _id: body.category, restaurant: req.rid, branch }))) throw httpError(400, 'Choose a category for this dish.');
  const price = num(req.body.basePrice, 'Enter a valid price (numbers only).');
  const cost = req.body.cost === '' || req.body.cost === undefined ? 0 : num(req.body.cost, 'Enter a valid food cost.');
  const item = await MenuItem.create({ ...body, restaurant: req.rid, branch, basePrice: price, price, cost });
  res.status(201).json(item);
});
router.put('/menu/:id', leads, async (req, res) => {
  const body = itemBody(req.body);
  if (!body.name) throw httpError(400, 'Enter the dish name.');
  const update = { ...body };
  if (req.body.basePrice !== undefined) { update.basePrice = num(req.body.basePrice, 'Enter a valid price (numbers only).'); update.price = update.basePrice; update.promoLabel = null; }
  if (req.body.cost !== undefined) update.cost = req.body.cost === '' ? 0 : num(req.body.cost, 'Enter a valid food cost.');
  const item = await MenuItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, update, { new: true });
  item ? res.json(item) : res.status(404).json({ message: 'Menu item not found.' });
});
router.patch('/menu/:id/availability', async (req, res) => {
  const item = await MenuItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, { available: !!req.body.available }, { new: true });
  res.json(item);
});
router.delete('/menu/:id', leads, async (req, res) => {
  await MenuItem.deleteOne({ _id: req.params.id, restaurant: req.rid });
  res.json({ ok: true });
});
// Copy a menu from one branch to another (skips dishes that already exist there)
router.post('/menu/copy', ownerOnly, async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to || from === to) throw httpError(400, 'Choose two different branches.');
  const [a, b] = await Promise.all([Branch.findOne({ _id: from, restaurant: req.rid }), Branch.findOne({ _id: to, restaurant: req.rid })]);
  if (!a || !b) throw httpError(400, 'Choose branches from your restaurant.');
  const [cats, items, existingCats, existingItems] = await Promise.all([
    Category.find({ branch: from }).lean(), MenuItem.find({ branch: from }).lean(),
    Category.find({ branch: to }).lean(), MenuItem.find({ branch: to }).select('name').lean(),
  ]);
  const map = {};
  for (const c of cats) {
    const found = existingCats.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
    map[c._id] = found ? found._id : (await Category.create({ restaurant: req.rid, branch: to, name: c.name, sort: c.sort }))._id;
  }
  const have = new Set(existingItems.map((i) => i.name.toLowerCase()));
  const fresh = items.filter((i) => !have.has(i.name.toLowerCase())).map(({ _id, createdAt, updatedAt, __v, ...i }) => ({ ...i, branch: to, category: map[i.category], price: i.basePrice, promoLabel: undefined }));
  if (fresh.length) await MenuItem.insertMany(fresh);
  logActivity(req, 'menu copied', `${a.name} to ${b.name}`);
  res.json({ copied: fresh.length, skipped: items.length - fresh.length });
});

/* ---------------- Orders, POS and payments ---------------- */
router.get('/orders', async (req, res) => {
  const q = scope(req);
  if (req.query.status === 'active') q.status = { $in: ['pending', 'confirmed', 'in_kitchen', 'ready', 'out_for_delivery'] };
  else if (req.query.status) q.status = req.query.status;
  if (req.query.source) q.source = req.query.source;
  res.json(await Order.find(q).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100).populate('branch', 'name').lean());
});
router.get('/orders/:id', async (req, res) => {
  const order = await Order.findOne(scope(req, { _id: req.params.id })).populate('branch', 'name address phone').lean();
  if (!order) throw httpError(404, 'Order not found.');
  res.json({ order, restaurant: { name: req.restaurant.name, phone: req.restaurant.phone } });
});
router.patch('/orders/:id/status', async (req, res) => {
  const order = await Order.findOne(scope(req, { _id: req.params.id }));
  if (!order) throw httpError(404, 'Order not found.');
  await setStatus(order, req.body.status, req.app.get('io'), { reason: req.body.reason });
  logActivity(req, `order ${req.body.status.replace(/_/g, ' ')}`, order.orderNo);
  res.json(order);
});
// Record payment for an order (POS ledger)
router.post('/orders/:id/pay', async (req, res) => {
  const order = await Order.findOne(scope(req, { _id: req.params.id }));
  if (!order) throw httpError(404, 'Order not found.');
  if (order.paymentStatus === 'paid') throw httpError(400, 'This order is already paid.');
  if (['rejected', 'cancelled'].includes(order.status)) throw httpError(400, 'This order was not completed.');
  if (!['cash', 'card', 'online'].includes(req.body.method)) throw httpError(400, 'Choose Cash, Card or Online.');
  await recordPayment(order, req.body.method, req.body.reference);
  await order.save();
  res.json(order);
});
router.post('/pos', async (req, res) => {
  const branchId = await pickBranch(req);
  const method = req.body.paymentMethod;
  const order = await createOrder({
    ...req.body, branchId, restaurantId: req.rid, source: 'pos', customerName: req.body.customerName || 'Walk-in',
    paid: !!req.body.paid, paymentMethod: method,
  }, req.app.get('io'));
  res.status(201).json(order);
});
router.get('/payments', async (req, res) => {
  const q = scope(req);
  if (req.query.method) q.method = req.query.method;
  if (req.query.from || req.query.to) q.paidAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(new Date(req.query.to).getTime() + 864e5) }) };
  const rows = await Payment.find(q).sort({ paidAt: -1 }).limit(300).populate('branch', 'name').lean();
  const paid = rows.filter((r) => r.status === 'paid');
  const totals = { cash: 0, card: 0, online: 0 };
  paid.forEach((r) => (totals[r.method] += r.amount));
  res.json({ rows, totals, refunded: rows.filter((r) => r.status === 'refunded').reduce((s, r) => s + r.amount, 0) });
});

/* ---------------- Inventory and suppliers ---------------- */
router.get('/inventory', async (req, res) =>
  res.json(await InventoryItem.find(scope(req)).populate('branch', 'name').populate('supplier', 'name').sort({ name: 1 }).select('-usageLogs -adjustments').lean()));
router.post('/inventory', leads, async (req, res) => {
  const branch = req.branchId || req.body.branch;
  if (!req.body.name?.trim()) throw httpError(400, 'Enter the item name.');
  if (!branch) throw httpError(400, 'Choose a branch.');
  const { usageLogs, wastageLogs, adjustments, ...body } = req.body;
  res.status(201).json(await InventoryItem.create({ ...body, branch, restaurant: req.rid }));
});
router.put('/inventory/:id', leads, async (req, res) => {
  const { usageLogs, wastageLogs, adjustments, restaurant, ...body } = req.body;
  const it = await InventoryItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, body, { new: true });
  it ? res.json(it) : res.status(404).json({ message: 'Item not found.' });
});
router.post('/inventory/:id/restock', async (req, res) => {
  const qty = Number(req.body.qty);
  if (!(qty > 0)) throw httpError(400, 'Enter a quantity above zero.');
  const it = await InventoryItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, { $inc: { quantity: qty } }, { new: true });
  if (it.quantity > it.reorderLevel) { it.alertedAt = null; await it.save(); }
  res.json(it);
});
router.post('/inventory/:id/wastage', async (req, res) => {
  const qty = Number(req.body.qty);
  if (!(qty > 0)) throw httpError(400, 'Enter a quantity above zero.');
  const it = await InventoryItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid },
    { $inc: { quantity: -qty }, $push: { wastageLogs: { qty, reason: req.body.reason || 'Spoiled' } } }, { new: true });
  checkLowStock(req.rid, it.branch).catch(() => {});
  res.json(it);
});
// Manual override after a physical audit: set the exact count, or add or deduct a quantity
router.post('/inventory/:id/adjust', async (req, res) => {
  const { mode, qty, reason } = req.body;
  const value = Number(qty);
  if (!Number.isFinite(value) || value < 0) throw httpError(400, 'Enter a valid quantity.');
  const it = await InventoryItem.findOne({ _id: req.params.id, restaurant: req.rid });
  if (!it) throw httpError(404, 'Item not found.');
  const before = it.quantity;
  if (mode === 'set') it.quantity = value;
  else if (mode === 'add') it.quantity += value;
  else if (mode === 'deduct') it.quantity = Math.max(0, it.quantity - value);
  else throw httpError(400, 'Choose set, add or deduct.');
  it.adjustments.push({ qty: it.quantity - before, reason: reason || 'Physical audit', by: req.user.name });
  if (it.quantity > it.reorderLevel) it.alertedAt = null;
  await it.save();
  logActivity(req, 'inventory adjusted', `${it.name}: ${before} to ${it.quantity}`);
  checkLowStock(req.rid, it.branch).catch(() => {});
  res.json(it);
});
router.delete('/inventory/:id', leads, async (req, res) => {
  await InventoryItem.deleteOne({ _id: req.params.id, restaurant: req.rid });
  res.json({ ok: true });
});

router.get('/suppliers', leads, async (req, res) => res.json(await Supplier.find({ restaurant: req.rid }).sort({ name: 1 }).populate('orders.branch', 'name').lean()));
router.post('/suppliers', leads, async (req, res) => {
  if (!req.body.name?.trim()) throw httpError(400, 'Enter the supplier name.');
  const { orders, restaurant, ...body } = req.body;
  res.status(201).json(await Supplier.create({ ...body, restaurant: req.rid }));
});
router.put('/suppliers/:id', leads, async (req, res) => {
  const { orders, restaurant, ...body } = req.body;
  res.json(await Supplier.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, body, { new: true }));
});
router.delete('/suppliers/:id', leads, async (req, res) => {
  await Supplier.deleteOne({ _id: req.params.id, restaurant: req.rid });
  await InventoryItem.updateMany({ supplier: req.params.id }, { $unset: { supplier: 1 } });
  res.json({ ok: true });
});
// Log a supply order (for example from the AI purchase list)
router.post('/suppliers/:id/orders', leads, async (req, res) => {
  const s = await Supplier.findOne({ _id: req.params.id, restaurant: req.rid });
  if (!s) throw httpError(404, 'Supplier not found.');
  const items = (req.body.items || []).filter((i) => i.name && Number(i.qty) > 0).map((i) => ({ name: i.name, qty: Number(i.qty), unit: i.unit, cost: Number(i.cost) || 0 }));
  if (!items.length) throw httpError(400, 'Add at least one item to the order.');
  s.orders.push({ branch: req.body.branch, items, total: items.reduce((t, i) => t + i.cost, 0), note: req.body.note });
  await s.save();
  logActivity(req, 'supply order logged', `${s.name}: ${items.length} items`);
  res.status(201).json(s);
});
// Mark a supply order received and add the goods to that branch's stock
router.patch('/suppliers/:id/orders/:oid/receive', leads, async (req, res) => {
  const s = await Supplier.findOne({ _id: req.params.id, restaurant: req.rid });
  const o = s?.orders.id(req.params.oid);
  if (!o) throw httpError(404, 'Supply order not found.');
  if (o.status === 'received') throw httpError(400, 'This order was already received.');
  for (const i of o.items) {
    await InventoryItem.updateOne({ restaurant: req.rid, branch: o.branch, name: new RegExp(`^${escapeRegex(i.name)}$`, 'i') }, { $inc: { quantity: i.qty }, $set: { alertedAt: null } });
  }
  o.status = 'received'; await s.save();
  res.json(s);
});

/* ---------------- Promotions ---------------- */
router.get('/coupons', async (req, res) => res.json(await Coupon.find({ restaurant: req.rid, source: 'manual' }).sort({ createdAt: -1 }).populate('branch', 'name').lean()));
const couponBody = (b) => {
  const value = Number(b.value);
  if (!b.code?.trim()) throw httpError(400, 'Enter a coupon code.');
  if (!Number.isFinite(value) || value <= 0) throw httpError(400, 'Enter a discount value above zero.');
  if (b.type === 'percent' && value > 100) throw httpError(400, 'A percentage discount cannot be above 100.');
  if (b.startsAt && b.expiresAt && new Date(b.expiresAt) < new Date(b.startsAt)) throw httpError(400, 'The end date must be after the start date.');
  return {
    code: b.code.trim().toUpperCase(), description: b.description, type: b.type === 'flat' ? 'flat' : 'percent', value,
    minOrder: Number(b.minOrder) || 0, usageLimit: Number(b.usageLimit) || 0, active: b.active !== false,
    startsAt: b.startsAt || undefined, expiresAt: b.expiresAt || undefined, branch: b.branch || undefined,
  };
};
router.post('/coupons', leads, async (req, res) => {
  const body = couponBody(req.body);
  if (await Coupon.findOne({ restaurant: req.rid, code: body.code })) throw httpError(409, 'This code already exists.');
  res.status(201).json(await Coupon.create({ ...body, restaurant: req.rid }));
});
router.put('/coupons/:id', leads, async (req, res) =>
  res.json(await Coupon.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, couponBody(req.body), { new: true })));
router.delete('/coupons/:id', leads, async (req, res) => { await Coupon.deleteOne({ _id: req.params.id, restaurant: req.rid }); res.json({ ok: true }); });

/* ---------------- Reviews ---------------- */
router.get('/reviews', async (req, res) => {
  const q = scope(req);
  if (req.query.sentiment) q['sentiment.label'] = req.query.sentiment;
  res.json(await Review.find(q).sort({ createdAt: -1 }).limit(150).populate('branch', 'name').lean());
});
router.patch('/reviews/:id/reply', async (req, res) => {
  if (!req.body.reply?.trim()) throw httpError(400, 'Write a reply first.');
  res.json(await Review.findOneAndUpdate({ _id: req.params.id, restaurant: req.rid }, { reply: req.body.reply.trim(), repliedAt: new Date() }, { new: true }));
});

/* ---------------- Analytics and AI ---------------- */
router.get('/analytics', async (req, res) => res.json(await overview(req.rid, req.branchId, Number(req.query.days) || 30)));
router.get('/ai/insights', async (req, res) => res.json(await ai.insights(req.rid, req.branchId)));
router.get('/ai/pricing', async (req, res) => res.json(await ai.pricingSuggestions(req.rid, req.branchId)));
router.post('/ai/pricing/apply', leads, async (req, res) => {
  const item = await MenuItem.findOne({ _id: req.body.itemId, restaurant: req.rid });
  if (!item) throw httpError(404, 'Menu item not found.');
  if (req.body.reset) { item.price = item.basePrice; item.promoLabel = undefined; }
  else { item.price = num(req.body.price, 'Enter a valid price.'); item.promoLabel = item.price < item.basePrice ? 'Special offer' : undefined; }
  await item.save();
  logActivity(req, req.body.reset ? 'ai price reset' : 'ai price applied', `${item.name}: Rs ${item.price}`);
  res.json(item);
});
router.post('/ai/surge', leads, async (req, res) => {
  const { enabled, pct, hours } = req.body;
  const p = Number(pct);
  if (enabled && (!(p > 0) || p > 25)) throw httpError(400, 'Peak pricing must be between 1% and 25%.');
  req.restaurant.surge = { enabled: !!enabled, pct: enabled ? p : 0, hours: enabled ? (hours || []).map(Number) : [] };
  await req.restaurant.save();
  logActivity(req, enabled ? 'peak pricing enabled' : 'peak pricing disabled', `${p || 0}%`);
  res.json(req.restaurant.surge);
});
router.get('/ai/forecast', async (req, res) => res.json(await ai.inventoryForecast(req.rid, req.branchId)));
router.get('/ai/sentiment', async (req, res) => res.json(await ai.sentimentSummary(req.rid, req.branchId)));
router.get('/ai/profitability', async (req, res) => res.json(await ai.profitability(req.rid, req.branchId, Number(req.query.days) || 30)));
router.post('/ai/image', leads, async (req, res) => {
  if (!req.body.name?.trim()) throw httpError(400, 'Enter the dish name first.');
  res.json(await ai.generateImage(req.body.name, req.body.description));
});
router.get('/reports', leads, async (req, res) => res.json(await Report.find({ restaurant: req.rid }).sort({ createdAt: -1 }).limit(12).lean()));
router.post('/reports', leads, async (req, res) => res.status(201).json(await buildReport(req.rid)));

/* ---------------- Team ---------------- */
router.get('/team', ownerOnly, async (req, res) =>
  res.json(await User.find({ restaurant: req.rid, role: { $in: ['manager', 'staff'] } }).select('-password -browsing').populate('branch', 'name').lean()));
router.post('/team', ownerOnly, async (req, res) => {
  const { name, email, password, role, branch } = req.body;
  if (!['manager', 'staff'].includes(role)) throw httpError(400, 'Choose manager or staff.');
  if (!name?.trim() || !email) throw httpError(400, 'Name and email are required.');
  if (!password || password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password)) throw httpError(400, 'Password must be at least 8 characters and include a letter and a number.');
  if (role === 'staff' && !(await Branch.findOne({ _id: branch, restaurant: req.rid }))) throw httpError(400, 'Choose the branch this staff member works at.');
  if (await User.findOne({ email: email.toLowerCase() })) throw httpError(409, 'This email is already in use.');
  const u = await User.create({ name, email, password, role, restaurant: req.rid, branch: role === 'staff' ? branch : undefined, emailVerified: true });
  logActivity(req, 'team member added', `${u.name} (${role})`);
  res.status(201).json({ _id: u._id, name: u.name, email: u.email, role: u.role });
});
router.delete('/team/:id', ownerOnly, async (req, res) => {
  await User.deleteOne({ _id: req.params.id, restaurant: req.rid, role: { $in: ['manager', 'staff'] } });
  res.json({ ok: true });
});

module.exports = router;
