const mongoose = require('mongoose');
module.exports = mongoose.model('MenuItem', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  basePrice: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 }, // live price (an approved AI offer may lower or raise it)
  cost: { type: Number, default: 0, min: 0 }, // food cost per portion, used for profitability
  image: String,
  dietaryTags: [{ type: String, enum: ['halal', 'veg', 'vegan', 'gluten-free', 'spicy'] }],
  available: { type: Boolean, default: true },
  prepMinutes: { type: Number, default: 15 },
  promoLabel: String,
  recipe: [{ name: String, qty: Number }], // ingredients per portion, matched to inventory by name
}, { timestamps: true }));
