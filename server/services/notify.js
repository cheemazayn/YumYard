const Notification = require('../models/Notification');
const User = require('../models/User');
const InventoryItem = require('../models/InventoryItem');
const { sendMail, sendSMS } = require('./mailer');

async function notifyUser(userId, restaurantId, { type, message, link }) {
  return Notification.create({ user: userId, restaurant: restaurantId, type, message, link }).catch(() => {});
}

// Owner and managers of a restaurant, optionally with email and SMS
async function notifyLeaders(restaurantId, payload, { email = false } = {}) {
  const leaders = await User.find({ restaurant: restaurantId, role: { $in: ['owner', 'manager'] }, status: 'active' });
  for (const u of leaders) {
    await notifyUser(u._id, restaurantId, payload);
    if (email) {
      sendMail({ to: u.email, subject: `YumYard alert: ${payload.type}`, text: payload.message });
      sendSMS(u.phone, payload.message);
    }
  }
}

async function notifyAdmins(payload) {
  const admins = await User.find({ role: 'admin' });
  for (const a of admins) await notifyUser(a._id, undefined, payload);
}

// Alerts owners when an ingredient falls to its minimum threshold (once every 12 hours per item)
async function checkLowStock(restaurantId, branchId) {
  const cutoff = new Date(Date.now() - 12 * 3600e3);
  const all = await InventoryItem.find({ restaurant: restaurantId, branch: branchId }).populate('branch', 'name');
  const low = all.filter((i) => i.quantity <= i.reorderLevel && (!i.alertedAt || i.alertedAt < cutoff));
  for (const it of low) {
    it.alertedAt = new Date();
    await it.save();
    await notifyLeaders(restaurantId, {
      type: 'low_stock',
      message: `Low stock: ${it.name} at ${it.branch?.name || 'a branch'} is down to ${Math.round(it.quantity * 100) / 100} ${it.unit} (minimum ${it.reorderLevel}).`,
      link: '/dashboard/inventory',
    }, { email: true });
  }
  return low.length;
}

module.exports = { notifyUser, notifyLeaders, notifyAdmins, checkLowStock };
