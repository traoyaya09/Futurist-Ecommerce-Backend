const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  weight: { type: Number, required: true },
  dimensions: {
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  trackingNumber: {
    type: String,
    default: null, // allow null initially
    unique: true,
    sparse: true   // ✅ allows multiple nulls without duplicate key errors
  },
}, { _id: false });

const shippingSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Shipped', 'Delivered', 'In Transit', 'Canceled', 'Returned'],
    default: 'Pending'
  },
  method: {
    type: String,
    enum: ['Standard', 'Express', 'Overnight', 'Two-Day'],
    required: true
  },
  estimatedDelivery: { type: Date },
  shippingCost: { type: Number, required: true, default: 0 },
  packages: [packageSchema],
  trackingNumbers: [{ type: String }], // denormalized from packages
  insurance: { type: Boolean, default: false },
  insuranceValue: { type: Number, default: 0 },
  dispatchedAt: { type: Date },
  deliveredAt: { type: Date }
}, { timestamps: true });

// Auto-populate trackingNumbers from packages
shippingSchema.pre('save', function(next) {
  this.trackingNumbers = this.packages.map(pkg => pkg.trackingNumber).filter(Boolean);
  next();
});

// Indexes
shippingSchema.index({ user: 1, status: 1 });
shippingSchema.index({ "packages.trackingNumber": 1, sparse: true }); // ✅ sparse ensures no duplicate error on null

const Shipping = mongoose.model('Shipping', shippingSchema);
module.exports = Shipping;
