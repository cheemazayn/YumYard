const mongoose = require('mongoose');
const { Schema } = mongoose;

const STATUSES = ['pending', 'confirmed', 'in_kitchen', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'];

const orderSchema = new Schema({
  orderNo: { type: String, index: true },
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String, default: 'Guest' },
  phone: String,
  items: [{ menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem' }, name: String, price: Number, qty: Number }],
  subtotal: Number,
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  serviceFee: { type: Number, default: 0 },
  total: Number,
  coupon: String,
  type: { type: String, enum: ['dine-in', 'takeaway', 'delivery'], default: 'dine-in' },
  source: { type: String, enum: ['website', 'pos'], default: 'website' },
  tableNo: String,
  address: String,
  note: String,
  status: { type: String, enum: STATUSES, default: 'pending' },
  rejectReason: String,
  paymentMethod: { type: String, enum: ['cash', 'card', 'online'], default: 'cash' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  estimatedMinutes: { type: Number, default: 20 },
  timeline: [{ status: String, at: { type: Date, default: Date.now }, _id: false }],
  readyAt: Date,
  outAt: Date,
  deliveredAt: Date,
  stockDeducted: { type: Boolean, default: false },
  reviewed: { type: Boolean, default: false },
}, { timestamps: true });

orderSchema.index({ restaurant: 1, createdAt: -1 });
module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
