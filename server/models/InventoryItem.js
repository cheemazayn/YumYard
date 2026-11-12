const mongoose = require('mongoose');
module.exports = mongoose.model('InventoryItem', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  name: { type: String, required: true, trim: true },
  unit: { type: String, default: 'kg' },
  quantity: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 5 }, // minimum threshold
  costPerUnit: { type: Number, default: 0 },
  perishable: { type: Boolean, default: true },
  alertedAt: Date,
  usageLogs: [{ qty: Number, date: { type: Date, default: Date.now }, _id: false }],
  wastageLogs: [{ qty: Number, reason: String, date: { type: Date, default: Date.now }, _id: false }],
  adjustments: [{ qty: Number, reason: String, by: String, date: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true }));
