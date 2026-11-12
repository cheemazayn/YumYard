const MenuItem = require('../models/MenuItem');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Branch = require('../models/Branch');
const Restaurant = require('../models/Restaurant');
const InventoryItem = require('../models/InventoryItem');
const { getSettings } = require('./settings');
const { effectivePrice } = require('./pricing');
const { httpError, escapeRegex } = require('./util');
const { checkLowStock, notifyLeaders, notifyUser } = require('./notify');

// Allowed status moves. Delivery orders must go through "out_for_delivery".
const FLOW = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['in_kitchen'],
  in_kitchen: ['ready'],
  ready: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
};

async function priceCoupon(restaurantId, branchId, code, subtotal) {
  if (!code) return { discount: 0 };
  const c = await Coupon.findOne({ restaurant: restaurantId, code: code.toUpperCase().trim(), active: true });
  const now = new Date();
  if (!c || (c.branch && String(c.branch) !== String(branchId))) throw httpError(400, 'Code Expired/Invalid.');
  if (c.startsAt && c.startsAt > now) throw httpError(400, 'This coupon is not active yet.');
  if (c.expiresAt && c.expiresAt < now) throw httpError(400, 'Code Expired/Invalid.');
  if (c.usageLimit && c.usedCount >= c.usageLimit) throw httpError(400, 'This coupon has reached its usage limit.');
  if (subtotal < c.minOrder) throw httpError(400, `Spend at least Rs ${c.minOrder} to use this coupon.`);
  const discount = c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
  return { discount, coupon: c };
}

async function recordPayment(order, method, reference) {
  order.paymentMethod = method;
  order.paymentStatus = 'paid';
  await Payment.create({
    restaurant: order.restaurant, branch: order.branch, order: order._id, orderNo: order.orderNo,
    amount: order.total, method, reference, status: 'paid',
  });
}

async function applyStock(order) {
  if (order.stockDeducted) return;
  const ids = order.items.map((i) => i.menuItem);
  const menu = await MenuItem.find({ _id: { $in: ids } }).select('recipe');
  for (const line of order.items) {
    const m = menu.find((x) => String(x._id) === String(line.menuItem));
    for (const ing of m?.recipe || []) {
      const used = ing.qty * line.qty;
      await InventoryItem.updateOne(
        { restaurant: order.restaurant, branch: order.branch, name: new RegExp(`^${escapeRegex(ing.name)}$`, 'i') },
        { $inc: { quantity: -used }, $push: { usageLogs: { qty: used, date: new Date() } } }
      );
    }
  }
  order.stockDeducted = true;
  checkLowStock(order.restaurant, order.branch).catch(() => {});
}

// Shared by the customer website and the POS screen
async function createOrder(data, io) {
  const { restaurantId, branchId, items = [], couponCode } = data;
  if (!items.length) throw httpError(400, 'Your cart is empty.');
  const [branch, restaurant, settings] = await Promise.all([
    Branch.findOne({ _id: branchId, restaurant: restaurantId, isActive: true }),
    Restaurant.findById(restaurantId),
    getSettings(),
  ]);
  if (!branch) throw httpError(400, 'Please choose a valid branch.');

  const menu = await MenuItem.find({ _id: { $in: items.map((i) => i.menuItem) }, restaurant: restaurantId, branch: branchId });
  const lines = items.map((i) => {
    const m = menu.find((x) => String(x._id) === String(i.menuItem));
    if (!m || !m.available) throw httpError(400, `${m?.name || 'An item'} is not available at this branch right now.`);
    return { doc: m, menuItem: m._id, name: m.name, price: effectivePrice(m, restaurant), qty: Math.max(1, Math.min(50, Number(i.qty) || 1)) };
  });

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const { discount, coupon } = await priceCoupon(restaurantId, branchId, couponCode, subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * settings.taxRate) / 100);
  const serviceFee = Math.round((taxable * settings.serviceFee) / 100);
  const prep = Math.max(...lines.map((l) => l.doc.prepMinutes || 15));
  const estimatedMinutes = prep + (lines.reduce((s, l) => s + l.qty, 0) > 4 ? 5 : 0) + (data.type === 'delivery' ? 15 : 0);
  const status = data.source === 'pos' ? 'confirmed' : 'pending';

  const order = await Order.create({
    orderNo: `YY${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
    restaurant: restaurantId, branch: branchId, customer: data.customer,
    customerName: data.customerName || 'Guest', phone: data.phone,
    items: lines.map(({ menuItem, name, price, qty }) => ({ menuItem, name, price, qty })),
    subtotal, discount, tax, serviceFee, total: taxable + tax + serviceFee,
    coupon: coupon?.code, type: data.type || 'dine-in', source: data.source || 'website',
    tableNo: data.tableNo, address: data.address, note: data.note,
    status, estimatedMinutes, timeline: [{ status, at: new Date() }],
  });
  if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

  // Card and online payments are confirmed at checkout. Cash is collected later and recorded in the ledger.
  const method = ['cash', 'card', 'online'].includes(data.paymentMethod) ? data.paymentMethod : 'cash';
  if (method !== 'cash' || data.paid) await recordPayment(order, method, data.reference || `TXN${Date.now().toString(36).toUpperCase()}`);
  else order.paymentMethod = 'cash';
  if (data.source === 'pos') await applyStock(order);
  await order.save();

  io?.to(`restaurant:${restaurantId}`).emit('order:new', { _id: order._id, orderNo: order.orderNo, branch: String(branchId), total: order.total });
  if (data.source !== 'pos')
    notifyLeaders(restaurantId, { type: 'new_order', message: `New order ${order.orderNo} for Rs ${order.total} at ${branch.name}.`, link: '/dashboard/orders' });
  return order;
}

async function setStatus(order, status, io, { reason } = {}) {
  if (!(FLOW[order.status] || []).includes(status))
    throw httpError(400, `An order that is ${order.status.replace(/_/g, ' ')} cannot be moved to ${status.replace(/_/g, ' ')}.`);
  if (status === 'out_for_delivery' && order.type !== 'delivery') throw httpError(400, 'Only delivery orders can go out for delivery.');
  if (status === 'delivered' && order.status === 'ready' && order.type === 'delivery')
    throw httpError(400, 'Mark this delivery order as out for delivery first.');

  const now = new Date();
  order.status = status;
  order.timeline.push({ status, at: now });
  if (status === 'ready') order.readyAt = now;
  if (status === 'out_for_delivery') order.outAt = now;
  if (status === 'delivered') { order.deliveredAt = now; order.readyAt = order.readyAt || now; }
  if (status === 'confirmed') await applyStock(order);

  if (['rejected', 'cancelled'].includes(status)) {
    order.rejectReason = reason;
    if (order.paymentStatus === 'paid') {
      await Payment.updateMany({ order: order._id, status: 'paid' }, { status: 'refunded' });
      order.paymentStatus = 'refunded';
    }
  }
  if (status === 'delivered' && order.paymentStatus === 'pending') await recordPayment(order, order.paymentMethod || 'cash');
  await order.save();

  const payload = { _id: order._id, status, readyAt: order.readyAt, deliveredAt: order.deliveredAt, timeline: order.timeline, paymentStatus: order.paymentStatus, rejectReason: order.rejectReason };
  io?.to(`order:${order._id}`).emit('order:update', payload);
  io?.to(`restaurant:${order.restaurant}`).emit('order:update', { _id: order._id, status });
  if (order.customer) {
    const text = {
      confirmed: 'was accepted', in_kitchen: 'is now being prepared', ready: 'is ready', out_for_delivery: 'is out for delivery',
      delivered: 'was delivered. Enjoy!', rejected: 'could not be accepted' + (order.paymentStatus === 'refunded' ? ' and your payment was refunded' : ''),
      cancelled: 'was cancelled',
    }[status];
    notifyUser(order.customer, order.restaurant, { type: 'order_status', message: `Order ${order.orderNo} ${text}.`, link: `/track/${order._id}` });
  }
  return order;
}

module.exports = { createOrder, setStatus, priceCoupon, recordPayment, applyStock, FLOW };
