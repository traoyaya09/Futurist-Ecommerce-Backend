const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // Link to the user making the payment
  amount: { type: Number, required: true },
  method: {
    type: String,
    enum: ['Credit Card', 'PayPal', 'Bank Transfer', 'Cash on Delivery', 'Cryptocurrency'],
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Processed', 'Failed', 'Refunded', 'Disputed'],
    default: 'Pending',
  },
  paymentGatewayResponse: { type: String, default: '' },  // Store payment gateway response details
  failureReason: { type: String, default: null },  // Reason for failure in case of failed payment
  transactionId: { type: String, unique: true, sparse: true },  // Unique transaction ID from payment gateway
  paymentDate: { type: Date, default: Date.now },  // Date when the payment was processed
  refundAmount: { type: Number, default: 0 },  // Track any refunded amount
  refundDate: { type: Date, default: null },  // Date when refund was processed (if applicable)
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },  // Additional metadata like IP address, device info, etc.
}, { timestamps: true });

// Indexes for optimized queries
paymentSchema.index({ order: 1, userId: 1, status: 1 });
//paymentSchema.index({ transactionId: 1 });

// Static method to calculate the total revenue from processed payments
paymentSchema.statics.calculateTotalRevenue = async function () {
  const result = await this.aggregate([
    { $match: { status: 'Processed' } },
    { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
  ]);
  return result.length > 0 ? result[0].totalRevenue : 0;
};

// Instance method to mark the payment as refunded
paymentSchema.methods.markAsRefunded = async function (refundAmount) {
  this.status = 'Refunded';
  this.refundAmount = refundAmount;
  this.refundDate = new Date();
  return this.save();
};

// Instance method to mark the payment as disputed
paymentSchema.methods.markAsDisputed = async function () {
  this.status = 'Disputed';
  return this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
