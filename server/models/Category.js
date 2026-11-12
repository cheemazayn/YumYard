const mongoose = require('mongoose');
module.exports = mongoose.model('Category', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  name: { type: String, required: true, trim: true },
  sort: { type: Number, default: 0 },
}, { timestamps: true }));
