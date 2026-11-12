const mongoose = require('mongoose');
module.exports = mongoose.model('Report', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  weekStart: Date,
  data: mongoose.Schema.Types.Mixed,
  auto: { type: Boolean, default: false },
}, { timestamps: true }));
