const mongoose = require('mongoose');
module.exports = mongoose.model('Branch', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  city: String,
  phone: String,
  operatingHours: { type: String, default: '11:00 AM - 11:00 PM' },
  geo: { lat: Number, lng: Number },
  isActive: { type: Boolean, default: true },
}, { timestamps: true }));
