const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  weight: { type: Number, required: true }, // Weight of the package in kg
  dimensions: {
    length: { type: Number, required: true }, // Length in cm
    width: { type: Number, required: true },  // Width in cm
    height: { type: Number, required: true }  // Height in cm
  },
  trackingNumber: { type: String, required: true }, // Unique tracking number for each package
});

const shippingSchema = new mongoose.Schema({
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
  estimatedDelivery: { type: Date }, // Expected delivery date based on shipping method
  shippingCost: { type: Number, required: true, default: 0 }, // Total cost of shipping
  trackingNumbers: [{ type: String }], // Array of tracking numbers for multi-package shipments
  packages: [packageSchema], // Array of packages for more detailed tracking
  insurance: {
    type: Boolean,
    default: false // Option to insure the shipment
  },
  insuranceValue: {
    type: Number,
    default: 0, // Value of insurance coverage
  },
  dispatchedAt: { type: Date }, // Date when the shipment was dispatched
  deliveredAt: { type: Date }, // Date when the shipment was delivered
}, { timestamps: true });

// Indexes to optimize queries
shippingSchema.index({ user: 1, status: 1 });
shippingSchema.index({ trackingNumbers: 1 });

const Shipping = mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;
