const mongoose = require('mongoose');
// One-time codes: email verification OTP, password reset link token, 2FA login code
module.exports = mongoose.model('Token', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['verify', 'reset', '2fa'], required: true },
  code: { type: String, required: true, index: true }, // sha256 of the value sent to the user
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
}, { timestamps: true }));
