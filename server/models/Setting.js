const mongoose = require('mongoose');
module.exports = mongoose.model('Setting', new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  taxRate: { type: Number, default: 5, min: 0, max: 100 },
  serviceFee: { type: Number, default: 0, min: 0, max: 100 },
  requireOwner2FA: { type: Boolean, default: false },
  requireEmailVerification: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));
