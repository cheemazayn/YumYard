const mongoose = require('mongoose');
module.exports = mongoose.model('Supplier', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  contact: String,
  phone: String,
  email: String,
  materials: [String],
  orders: [{
    date: { type: Date, default: Date.now },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    items: [{ name: String, qty: Number, unit: String, cost: Number }],
    total: Number,
    note: String,
    status: { type: String, enum: ['ordered', 'received'], default: 'ordered' },
  }],
}, { timestamps: true }));
