const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    totalItemPrice: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true, enum: ['Credit Card', 'PayPal', 'Cash on Delivery', 'Bank Transfer'] },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },

    // ✅ now an object
    shippingAddress: {
        name: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: String, required: true },
        phone: { type: String, required: true }
    },

    shippingStatus: { type: String, enum: ['Not Shipped', 'Shipped', 'Delivered'], default: 'Not Shipped' },
    status: { type: String, enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' },
    trackingNumbers: [{ type: String }],
    shipments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shipping' }],
    estimatedDelivery: { type: Date },
    shippingCost: { type: Number, default: 0 },
    insurance: { type: Boolean, default: false },
    insuranceValue: { type: Number, default: 0 },
    cancellationReason: { type: String, default: null },
    refundStatus: { type: String, enum: ['None', 'Requested', 'Completed'], default: 'None' },
}, { timestamps: true });


// Static method to calculate totals
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

// Pre-save hook
orderSchema.pre('save', function (next) {
    const { totalAmount, discountAmount, netAmount } = this.constructor.calculateOrderTotals(this.items);
    this.totalAmount = totalAmount;
    this.discountAmount = discountAmount;
    this.netAmount = netAmount;
    next();
});

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
