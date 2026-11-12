const router = require('express').Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', async (req, res) => {
  const list = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({ items: list, unread: list.filter((n) => !n.isRead).length });
});
router.post('/read', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ ok: true });
});
module.exports = router;
