// backend/models/UserMemoryModel.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'ai'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const UserMemorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [MessageSchema],

  // Current cart snapshot
  cartItems: [{ 
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number
  }],
  appliedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
  discount: { type: Number, default: 0 },
  finalTotal: { type: Number, default: 0 }, // AI can reference for reasoning

  orderInProgress: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  lastAction: String // e.g., 'searching_product', 'checkout_pending'
}, { timestamps: true });

/**
 * Sync UserMemory with the actual Cart
 * Updates cartItems, appliedPromotion, discount, and finalTotal
 */
UserMemorySchema.statics.syncMemoryCart = async function(userId) {
  const Cart = require('./CartModel'); // require here to avoid circular dependency
  const memory = await this.findOne({ userId });
  const cart = await Cart.findOne({ user: userId }).populate('items.productId');

  if (memory && cart) {
    // Map cart items to memory format
    memory.cartItems = cart.items.map(i => ({
      productId: i.product?._id ?? i.product_id,
      quantity: i.quantity
    }));

    // Sync promotion and discount
    memory.appliedPromotion = cart.appliedPromotion ?? null;
    memory.discount = cart.discount ?? 0;

    // Compute finalTotal safely
    memory.finalTotal = cart.finalTotal ?? cart.items.reduce((sum, i) => sum + (i.total ?? 0), 0) - (cart.discount ?? 0);

    await memory.save();
  }
};

module.exports = mongoose.model('UserMemory', UserMemorySchema);
