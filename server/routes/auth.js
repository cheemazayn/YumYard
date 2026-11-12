const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/Token');
const Session = require('../models/Session');
const Restaurant = require('../models/Restaurant');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const GameScore = require('../models/GameScore');
const { issueSession, protect, allow, SECRET } = require('../middleware/auth');
const { getSettings } = require('../services/settings');
const { sendMail, devMode } = require('../services/mailer');
const { notifyAdmins } = require('../services/notify');
const { logActivity } = require('../services/activity');
const { sha, otp, randomToken, slugify, httpError } = require('../services/util');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{7,14}$/;
const strong = (p = '') => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const WEAK = 'Password must be at least 8 characters and include a letter and a number.';
const STAFF_ROLES = ['owner', 'manager', 'staff'];

const pack = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status,
  restaurant: u.restaurant, branch: u.branch, addresses: u.addresses, points: u.points,
  emailVerified: u.emailVerified, twoFactorEnabled: u.twoFactorEnabled,
});

async function sendOtp(user, kind, subject) {
  await Token.deleteMany({ user: user._id, kind });
  const code = otp();
  await Token.create({ user: user._id, kind, code: sha(code), expiresAt: new Date(Date.now() + 10 * 60000) });
  await sendMail({ to: user.email, subject, text: `Your YumYard code is ${code}. It expires in 10 minutes.` });
  return devMode() ? { devOtp: code } : {};
}

/* ---------- Customer registration and email verification ---------- */
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name?.trim() || !email || !password) throw httpError(400, 'Name, email and password are required.');
  if (!EMAIL.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (!strong(password)) throw httpError(400, WEAK);
  if (phone && !PHONE.test(phone)) throw httpError(400, 'Enter a valid phone number.');
  if (await User.findOne({ email: email.toLowerCase() })) throw httpError(409, 'An account with this email already exists.');

  const settings = await getSettings();
  const user = await User.create({ name, email, password, phone, role: 'customer', emailVerified: !settings.requireEmailVerification });
  if (settings.requireEmailVerification) {
    const dev = await sendOtp(user, 'verify', 'Verify your YumYard account');
    return res.status(201).json({ needsVerification: true, email: user.email, ...dev });
  }
  const { token } = await issueSession(user, req);
  res.status(201).json({ token, user: pack(user) });
});

router.post('/verify-email', async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  const t = user && (await Token.findOne({ user: user._id, kind: 'verify', code: sha(req.body.code || ''), used: false, expiresAt: { $gt: new Date() } }));
  if (!t) throw httpError(400, 'That code is incorrect or has expired.');
  t.used = true; await t.save();
  user.emailVerified = true; await user.save();
  const { token } = await issueSession(user, req);
  res.json({ token, user: pack(user) });
});

router.post('/resend-otp', async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user) throw httpError(404, 'Email not found.');
  res.json({ ok: true, ...(await sendOtp(user, 'verify', 'Verify your YumYard account')) });
});

/* ---------- Restaurant owner registration (goes to admin for approval) ---------- */
router.post('/register-restaurant', async (req, res) => {
  const { name, email, password, phone, restaurantName, cuisine, address, city, documents = [] } = req.body;
  if (!name?.trim() || !email || !password || !restaurantName?.trim() || !address?.trim()) throw httpError(400, 'Please fill in all required fields.');
  if (!EMAIL.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (!strong(password)) throw httpError(400, WEAK);
  if (phone && !PHONE.test(phone)) throw httpError(400, 'Enter a valid phone number.');
  if (!documents.length) throw httpError(400, 'Upload at least one business document so we can verify your restaurant.');
  if (await User.findOne({ email: email.toLowerCase() })) throw httpError(409, 'An account with this email already exists.');

  let slug = slugify(restaurantName) || 'restaurant';
  if (await Restaurant.findOne({ slug })) slug += '-' + Math.floor(Math.random() * 900 + 100);

  const owner = await User.create({ name, email, password, phone, role: 'owner', emailVerified: true });
  const restaurant = await Restaurant.create({
    name: restaurantName, slug, owner: owner._id, status: 'pending', cuisine: cuisine || 'Restaurant', phone, email,
    documents: documents.map((d) => ({ name: d.name, url: d.url })),
    tagline: 'Fresh food, made to order.',
    about: `Welcome to ${restaurantName}. Browse our menu and order online.`,
    cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
  });
  await Branch.create({ restaurant: restaurant._id, name: 'Main Branch', address, city, phone });
  owner.restaurant = restaurant._id; await owner.save();
  notifyAdmins({ type: 'approval', message: `${restaurantName} applied to join YumYard.`, link: '/admin/approvals' });
  const { token } = await issueSession(owner, req);
  res.status(201).json({ token, user: pack(owner), restaurant: { slug, status: 'pending' } });
});

/* ---------- Login (with optional 2FA) ---------- */
router.post('/login', async (req, res) => {
  const { email, password, portal } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !(await user.matches(password || ''))) throw httpError(401, 'Email or password is incorrect.');
  if (['suspended', 'blocked'].includes(user.status)) throw httpError(403, 'This account has been suspended. Contact support for help.');
  if (portal === 'owner' && !STAFF_ROLES.includes(user.role)) throw httpError(403, 'This portal is for restaurant accounts. Use the customer login instead.');
  if (portal === 'admin' && user.role !== 'admin') throw httpError(403, 'This portal is restricted to administrators.');
  if (portal === 'customer' && user.role !== 'customer') throw httpError(403, 'Restaurant and admin accounts sign in through their own portal.');

  const settings = await getSettings();
  if (user.role === 'customer' && settings.requireEmailVerification && !user.emailVerified) {
    const dev = await sendOtp(user, 'verify', 'Verify your YumYard account');
    return res.status(403).json({ code: 'UNVERIFIED', email: user.email, message: 'Verify your email to continue. We sent you a new code.', ...dev });
  }
  const needs2FA = user.twoFactorEnabled || (user.role === 'owner' && settings.requireOwner2FA);
  if (needs2FA) {
    const dev = await sendOtp(user, '2fa', 'Your YumYard login code');
    const tempToken = jwt.sign({ id: user._id, purpose: '2fa' }, SECRET(), { expiresIn: '10m' });
    return res.json({ twoFactorRequired: true, tempToken, ...dev });
  }
  const { token } = await issueSession(user, req);
  logActivity(req, 'login', user.email, user);
  res.json({ token, user: pack(user) });
});

router.post('/verify-2fa', async (req, res) => {
  let payload;
  try { payload = jwt.verify(req.body.tempToken || '', SECRET()); } catch { throw httpError(401, 'Your login attempt expired. Sign in again.'); }
  if (payload.purpose !== '2fa') throw httpError(401, 'Invalid request.');
  const t = await Token.findOne({ user: payload.id, kind: '2fa', code: sha(req.body.code || ''), used: false, expiresAt: { $gt: new Date() } });
  if (!t) throw httpError(400, 'That code is incorrect. Access denied.');
  t.used = true; await t.save();
  const user = await User.findById(payload.id);
  const { token } = await issueSession(user, req, true);
  logActivity(req, 'login (2fa)', user.email, user);
  res.json({ token, user: pack(user) });
});

/* ---------- Password recovery ---------- */
router.post('/forgot-password', async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user) throw httpError(404, 'Email not found.');
  await Token.deleteMany({ user: user._id, kind: 'reset' });
  const raw = randomToken();
  await Token.create({ user: user._id, kind: 'reset', code: sha(raw), expiresAt: new Date(Date.now() + 3600e3) });
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${raw}`;
  await sendMail({ to: user.email, subject: 'Reset your YumYard password', text: `Use this link within one hour to choose a new password:\n${link}` });
  res.json({ ok: true, ...(devMode() ? { devLink: link } : {}) });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!strong(password)) throw httpError(400, WEAK);
  const t = await Token.findOne({ kind: 'reset', code: sha(token || ''), used: false });
  if (!t || t.expiresAt < new Date()) throw httpError(400, 'This link has expired. Request a new one.');
  const user = await User.findById(t.user);
  user.password = password; await user.save();
  t.used = true; await t.save();
  await Session.updateMany({ user: user._id }, { revoked: true });
  res.json({ ok: true });
});

/* ---------- Everything below needs a session ---------- */
router.use(protect);

router.get('/me', async (req, res) => {
  const restaurant = req.user.restaurant ? await Restaurant.findById(req.user.restaurant).select('name slug status plan isPublished rejectionReason') : null;
  res.json({ user: pack(req.user), restaurant });
});

router.put('/me', async (req, res) => {
  const { name, phone, addresses } = req.body;
  const user = await User.findById(req.user._id);
  if (name !== undefined) { if (!name.trim()) throw httpError(400, 'Name cannot be empty.'); user.name = name.trim(); }
  if (phone !== undefined) { if (phone && !PHONE.test(phone)) throw httpError(400, 'Enter a valid phone number.'); user.phone = phone; }
  if (addresses) user.addresses = addresses.filter((a) => a.line?.trim()).map((a) => ({ label: a.label || 'Home', line: a.line.trim() }));
  await user.save();
  res.json({ user: pack(user) });
});

router.post('/change-password', async (req, res) => {
  const { current, next } = req.body;
  const user = await User.findById(req.user._id);
  if (!(await user.matches(current || ''))) throw httpError(400, 'Your current password is incorrect.');
  if (!strong(next)) throw httpError(400, WEAK);
  user.password = next; await user.save();
  await Session.updateMany({ user: user._id, _id: { $ne: req.session._id } }, { revoked: true });
  logActivity(req, 'password changed', user.email);
  res.json({ ok: true });
});

router.post('/2fa', allow('owner', 'manager', 'admin'), async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { twoFactorEnabled: !!req.body.enabled });
  logActivity(req, req.body.enabled ? '2fa enabled' : '2fa disabled', req.user.email);
  res.json({ twoFactorEnabled: !!req.body.enabled });
});

router.get('/sessions', async (req, res) => {
  const list = await Session.find({ user: req.user._id, revoked: false, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  res.json(list.map((s) => ({ _id: s._id, device: s.device, ip: s.ip, createdAt: s.createdAt, current: String(s._id) === String(req.session._id) })));
});
router.delete('/sessions/:id', async (req, res) => {
  await Session.updateOne({ _id: req.params.id, user: req.user._id }, { revoked: true });
  res.json({ ok: true });
});
router.delete('/sessions', async (req, res) => {
  await Session.updateMany({ user: req.user._id, _id: { $ne: req.session._id } }, { revoked: true });
  res.json({ ok: true });
});
router.post('/logout', async (req, res) => {
  await Session.updateOne({ _id: req.session._id }, { revoked: true });
  res.json({ ok: true });
});

// Permanent deletion for customer accounts
router.delete('/me', allow('customer'), async (req, res) => {
  if (!req.body.confirm) return res.status(200).json({ confirmationRequired: true, message: 'Are you sure? This permanently deletes your account and personal data.' });
  const id = req.user._id;
  await Promise.all([
    Session.deleteMany({ user: id }), Token.deleteMany({ user: id }), Notification.deleteMany({ user: id }), GameScore.deleteMany({ customer: id }),
    Order.updateMany({ customer: id }, { $unset: { customer: 1 }, customerName: 'Deleted user', phone: '' }),
    Review.updateMany({ customer: id }, { $unset: { customer: 1 }, name: 'Deleted user' }),
  ]);
  await User.deleteOne({ _id: id });
  res.json({ deleted: true });
});

module.exports = router;
