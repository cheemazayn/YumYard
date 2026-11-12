const router = require('express').Router();
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const Setting = require('../models/Setting');
const { protect, allow } = require('../middleware/auth');
const { getSettings } = require('../services/settings');
const { logActivity } = require('../services/activity');
const { notifyUser } = require('../services/notify');
const { sendMail } = require('../services/mailer');
const { httpError } = require('../services/util');

router.use(protect, allow('admin'));

router.get('/overview', async (req, res) => {
  const [restaurants, customers, orders, branches, pending] = await Promise.all([
    Restaurant.find().populate('owner', 'name email').lean(),
    User.countDocuments({ role: 'customer' }),
    Order.aggregate([{ $match: { status: { $nin: ['cancelled', 'rejected'] } } }, { $group: { _id: '$restaurant', revenue: { $sum: '$total' }, orders: { $sum: 1 } } }]),
    Branch.aggregate([{ $group: { _id: '$restaurant', n: { $sum: 1 } } }]),
    Restaurant.countDocuments({ status: 'pending' }),
  ]);
  const list = restaurants.map((r) => {
    const o = orders.find((x) => String(x._id) === String(r._id));
    return { ...r, revenue: o?.revenue || 0, orders: o?.orders || 0, branches: branches.find((b) => String(b._id) === String(r._id))?.n || 0 };
  });
  res.json({
    customers, restaurants: list,
    totals: {
      restaurants: list.filter((r) => r.status === 'active').length, pending,
      subscribed: list.filter((r) => r.plan.status === 'active').length,
      trial: list.filter((r) => r.status === 'active' && r.plan.status === 'trial').length,
      orders: list.reduce((s, r) => s + r.orders, 0), revenue: list.reduce((s, r) => s + r.revenue, 0),
    },
  });
});

/* Owner registration approvals */
router.get('/approvals', async (req, res) => {
  res.json(await Restaurant.find({ status: req.query.status || 'pending' }).sort({ createdAt: -1 }).populate('owner', 'name email phone').lean());
});
router.post('/restaurants/:id/decision', async (req, res) => {
  const { decision, reason } = req.body;
  const r = await Restaurant.findById(req.params.id);
  if (!r) throw httpError(404, 'Restaurant not found.');
  if (!['approve', 'reject'].includes(decision)) throw httpError(400, 'Choose approve or reject.');
  if (decision === 'reject' && !reason?.trim()) throw httpError(400, 'Tell the owner why the application was rejected, or what is missing.');
  if (decision === 'approve') {
    r.status = 'active'; r.isPublished = true; r.rejectionReason = undefined;
    r.plan = { status: 'trial', trialEndsAt: new Date(Date.now() + 7 * 864e5) };
  } else { r.status = 'rejected'; r.rejectionReason = reason.trim(); }
  await r.save();
  const owner = await User.findById(r.owner);
  if (owner) {
    const msg = decision === 'approve' ? `${r.name} has been approved. Your 7 day free trial has started.` : `${r.name} was not approved: ${reason}`;
    notifyUser(owner._id, r._id, { type: 'approval', message: msg, link: '/dashboard' });
    sendMail({ to: owner.email, subject: `YumYard application ${decision === 'approve' ? 'approved' : 'update'}`, text: msg });
  }
  logActivity(req, `restaurant ${decision}d`, r.name);
  res.json(r);
});
router.patch('/restaurants/:id', async (req, res) => {
  const { planStatus, published } = req.body;
  const r = await Restaurant.findById(req.params.id);
  if (!r) throw httpError(404, 'Restaurant not found.');
  if (planStatus) {
    r.plan.status = planStatus;
    if (planStatus === 'active') r.plan.activatedAt = new Date();
    if (planStatus === 'trial') r.plan.trialEndsAt = new Date(Date.now() + 7 * 864e5);
  }
  if (published !== undefined) r.isPublished = published;
  await r.save();
  logActivity(req, `restaurant plan/visibility changed`, `${r.name}: ${planStatus || (published ? 'published' : 'hidden')}`);
  res.json(r);
});

/* Centralized user management */
router.get('/users', async (req, res) => {
  const { search, role, status } = req.query;
  const q = {};
  if (role) q.role = role;
  if (status) q.status = status;
  if (search) q.$or = [{ name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
  res.json(await User.find(q).select('-password -browsing').sort({ createdAt: -1 }).limit(200).populate('restaurant', 'name').lean());
});
router.patch('/users/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'blocked'].includes(status)) throw httpError(400, 'Invalid status.');
  const u = await User.findById(req.params.id);
  if (!u) throw httpError(404, 'User not found.');
  if (u.role === 'admin') throw httpError(400, 'Administrator accounts cannot be suspended here.');
  u.status = status; await u.save();
  if (status !== 'active') await Session.updateMany({ user: u._id }, { revoked: true });
  logActivity(req, `user ${status}`, u.email);
  res.json({ _id: u._id, status: u.status });
});

/* System controls */
router.get('/settings', async (req, res) => res.json(await getSettings()));
router.put('/settings', async (req, res) => {
  const { taxRate, serviceFee, requireOwner2FA, requireEmailVerification } = req.body;
  const s = await getSettings();
  for (const [k, v] of Object.entries({ taxRate, serviceFee })) {
    if (v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw httpError(400, 'Fees must be a number between 0 and 100. Negative values are not allowed.');
    s[k] = n;
  }
  if (requireOwner2FA !== undefined) s.requireOwner2FA = !!requireOwner2FA;
  if (requireEmailVerification !== undefined) s.requireEmailVerification = !!requireEmailVerification;
  s.updatedBy = req.user._id;
  await s.save();
  logActivity(req, 'system settings updated', `tax ${s.taxRate}%, service fee ${s.serviceFee}%`);
  res.json(s);
});

/* Activity logs */
const logQuery = (q) => {
  const f = {};
  if (q.action) f.action = new RegExp(q.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (q.user) f.userName = new RegExp(q.user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(new Date(q.to).getTime() + 864e5) }) };
  return f;
};
router.get('/logs', async (req, res) => res.json(await ActivityLog.find(logQuery(req.query)).sort({ createdAt: -1 }).limit(300).lean()));
router.get('/logs/export', async (req, res) => {
  const rows = await ActivityLog.find(logQuery(req.query)).sort({ createdAt: -1 }).limit(5000).lean();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['Time,User,Role,Action,Target,IP', ...rows.map((r) => [new Date(r.createdAt).toISOString(), r.userName, r.role, r.action, r.target, r.ip].map(esc).join(','))].join('\n');
  logActivity(req, 'activity logs exported', `${rows.length} rows`);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="yumyard-activity-logs.csv"');
  res.send(csv);
});

module.exports = router;
