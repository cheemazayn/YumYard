const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Restaurant = require('../models/Restaurant');

const SECRET = () => process.env.JWT_SECRET || 'dev-secret';

async function issueSession(user, req, twoFactorVerified = false) {
  const session = await Session.create({
    user: user._id,
    device: (req.headers['user-agent'] || 'Unknown device').slice(0, 140),
    ip: req.ip,
    twoFactorVerified,
    expiresAt: new Date(Date.now() + 7 * 864e5),
  });
  const token = jwt.sign({ id: user._id, sid: session._id }, SECRET(), { expiresIn: '7d' });
  return { token, session };
}

async function readAuth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const p = jwt.verify(h.slice(7), SECRET());
    if (!p.sid) return null;
    const [user, session] = await Promise.all([User.findById(p.id).select('-password'), Session.findById(p.sid)]);
    if (!user || !session || session.revoked || session.expiresAt < new Date()) return null;
    return { user, session };
  } catch {
    return null;
  }
}

const protect = async (req, res, next) => {
  const auth = await readAuth(req);
  if (!auth) return res.status(401).json({ message: 'Please log in to continue.' });
  if (['suspended', 'blocked'].includes(auth.user.status))
    return res.status(403).json({ message: 'This account has been suspended. Contact support for help.' });
  req.user = auth.user;
  req.session = auth.session;
  next();
};

const optionalAuth = async (req, res, next) => {
  const auth = await readAuth(req);
  req.user = auth && !['suspended', 'blocked'].includes(auth.user.status) ? auth.user : null;
  next();
};

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have access to this section.' });

// Loads the restaurant for dashboard users, enforces approval and trial status
const restaurantContext = async (req, res, next) => {
  const restaurant = req.user.restaurant && (await Restaurant.findById(req.user.restaurant));
  if (!restaurant) return res.status(403).json({ message: 'This account is not linked to a restaurant.' });
  req.restaurant = restaurant;
  req.rid = restaurant._id;
  // Owners and managers see every branch (optionally filtered); branch staff are locked to theirs.
  req.branchId = ['owner', 'manager'].includes(req.user.role) ? req.query.branch || null : req.user.branch || null;

  const readingProfile = req.method === 'GET' && req.path === '/restaurant';
  if (!readingProfile) {
    if (restaurant.status === 'pending')
      return res.status(403).json({ code: 'PENDING', message: 'Your application is waiting for admin approval.' });
    if (restaurant.status === 'rejected')
      return res.status(403).json({ code: 'REJECTED', message: restaurant.rejectionReason || 'Your application was not approved.' });
    if (restaurant.isExpired() && req.method !== 'GET')
      return res.status(402).json({ code: 'EXPIRED', message: 'Your free trial has ended. Please activate a subscription.' });
  }
  next();
};

module.exports = { issueSession, protect, optionalAuth, allow, restaurantContext, SECRET };
