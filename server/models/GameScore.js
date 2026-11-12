const mongoose = require('mongoose');
module.exports = mongoose.model('GameScore', new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  game: String,
  score: Number,
  points: Number,
  waitTimer: Number, // seconds left on the wait timer when the game ended
  reward: String,
}, { timestamps: true }));
