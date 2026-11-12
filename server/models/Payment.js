const mongoose = require('mongoose');
// POS ledger: one row per payment (or refund)
module.exports = mongoose.model('Payment', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNo: String,
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'card', 'online'], required: true },
  status: { type: String, enum: ['paid', 'refunded'], default: 'paid' },
  reference: String,
  paidAt: { type: Date, default: Date.now },
}, { timestamps: true }));
