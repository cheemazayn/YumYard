const mongoose = require('mongoose');
module.exports = mongoose.model('Session', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  device: String,
  ip: String,
  twoFactorVerified: { type: Boolean, default: false },
  revoked: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true }));
