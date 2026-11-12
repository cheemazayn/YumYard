const mongoose = require('mongoose');
module.exports = mongoose.model('Coupon', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // empty = all branches
  code: { type: String, required: true, uppercase: true, trim: true },
  description: String,
  type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  value: { type: Number, required: true, min: 0 },
  minOrder: { type: Number, default: 0 },
  startsAt: Date,
  expiresAt: Date,
  usageLimit: { type: Number, default: 0 }, // 0 = unlimited
  usedCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  source: { type: String, enum: ['manual', 'game'], default: 'manual' },
}, { timestamps: true }));
