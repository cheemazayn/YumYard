const mongoose = require('mongoose');
module.exports = mongoose.model('ActivityLog', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  role: String,
  action: { type: String, index: true },
  target: String,
  ip: String,
}, { timestamps: true }));
