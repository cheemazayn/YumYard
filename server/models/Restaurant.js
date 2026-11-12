const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
    rejectionReason: String,
    documents: [{ name: String, url: String }],
    tagline: { type: String, default: '' },
    about: { type: String, default: '' },
    cuisine: { type: String, default: 'Restaurant' },
    logo: String,
    cover: String,
    gallery: [String],
    template: { type: String, enum: ['classic', 'modern', 'bold'], default: 'modern' },
    theme: {
      primary: { type: String, default: '#1F4D3A' },
      secondary: { type: String, default: '#F0A81F' },
      font: { type: String, default: 'Bricolage Grotesque' },
    },
    phone: String,
    email: String,
    openingHours: { type: String, default: '11:00 AM - 11:00 PM' },
    social: { instagram: String, facebook: String },
    isPublished: { type: Boolean, default: false },
    // AI-approved dynamic pricing during busy hours
    surge: { enabled: { type: Boolean, default: false }, pct: { type: Number, default: 0 }, hours: [Number] },
    plan: {
      status: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
      trialEndsAt: Date,
      activatedAt: Date,
    },
  },
  { timestamps: true }
);

restaurantSchema.methods.isExpired = function () {
  if (this.plan.status === 'active') return false;
  if (this.plan.status === 'expired') return true;
  return !!this.plan.trialEndsAt && this.plan.trialEndsAt < new Date();
};
restaurantSchema.methods.isLive = function () {
  return this.status === 'active' && this.isPublished && !this.isExpired();
};

module.exports = mongoose.model('Restaurant', restaurantSchema);
