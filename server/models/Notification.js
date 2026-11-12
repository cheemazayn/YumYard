const mongoose = require('mongoose');
module.exports = mongoose.model('Notification', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
  type: String,
  message: String,
  link: String,
  isRead: { type: Boolean, default: false },
}, { timestamps: true }));
