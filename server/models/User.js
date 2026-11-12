const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    phone: String,
    role: { type: String, enum: ['customer', 'owner', 'manager', 'staff', 'admin'], default: 'customer' },
    status: { type: String, enum: ['active', 'pending', 'suspended', 'blocked'], default: 'active' },
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    addresses: [{ label: String, line: String }],
    points: { type: Number, default: 0 },
    browsing: [{ type: Schema.Types.ObjectId, ref: 'MenuItem' }],
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.matches = function (plain) { return bcrypt.compare(plain, this.password); };

module.exports = mongoose.model('User', userSchema);
