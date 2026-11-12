const mongoose = require('mongoose');
module.exports = mongoose.model('Review', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, default: 'Guest' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: '' },
  sentiment: {
    label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
    score: { type: Number, default: 0 },
    topics: [String],
    source: { type: String, default: 'rules' },
  },
  reply: String,
  repliedAt: Date,
}, { timestamps: true }));
