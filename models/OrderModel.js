const mongoose = require('mongoose');

// Schema for each order item, including product reference and price at time of order
const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },  // Store the price at the time of the order
    discount: { type: Number, default: 0 },  // Optional discount per item
    totalItemPrice: { type: Number, required: true }  // Calculated total price per item (quantity * price - discount)
}, { _id: false });

// Main order schema
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],  // List of ordered items
    totalAmount: { type: Number, required: true },  // Total amount for the order
    discountAmount: { type: Number, default: 0 },  // Total discount applied to the order
    netAmount: { type: Number, required: true },  // Net payable amount (totalAmount - discountAmount)
    paymentMethod: { type: String, required: true, enum: ['Credit Card', 'PayPal', 'Cash on Delivery', 'Bank Transfer'] },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },  // Track payment status
    shippingAddress: { type: String, required: true },  // Shipping address for the order
    shippingStatus: { type: String, enum: ['Not Shipped', 'Shipped', 'Delivered'], default: 'Not Shipped' },  // Track shipping status
    status: { type: String, enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' },  // General order status
    trackingNumber: { type: String, default: null },  // Shipping tracking number
    estimatedDelivery: { type: Date },  // Estimated delivery date
    cancellationReason: { type: String, default: null },  // Reason for cancellation if applicable
    refundStatus: { type: String, enum: ['None', 'Requested', 'Completed'], default: 'None' },  // Refund status for cancelled orders
    // Add other fields like tax, currency, or additional shipping info as needed
}, { timestamps: true });

// Static method to calculate total price, discounts, and net amount
orderSchema.statics.calculateOrderTotals = function(items) {
    let totalAmount = 0;
    let discountAmount = 0;

    items.forEach(item => {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        discountAmount += item.discount || 0;
        item.totalItemPrice = itemTotal - (item.discount || 0);
    });

    const netAmount = totalAmount - discountAmount;
    return { totalAmount, discountAmount, netAmount };
};

// Middleware to auto-calculate total and net amounts before saving the order
orderSchema.pre('save', function (next) {
    const { totalAmount, discountAmount, netAmount } = Order.calculateOrderTotals(this.items);
    this.totalAmount = totalAmount;
    this.discountAmount = discountAmount;
    this.netAmount = netAmount;
    next();
});

// Indexes for optimization
orderSchema.index({ userId: 1, createdAt: -1 });  // Index on user and order creation date for faster queries
orderSchema.index({ status: 1 });  // Index on status for filtering orders by status

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
