const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, required: true },
  price: { type: Number, required: true },
  total: { type: Number }
}, { _id: true });

const savedItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  addedAt: { type: Date, default: Date.now }
});

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [cartItemSchema],
  savedItems: [savedItemSchema],
  total: { type: Number, default: 0 },
  appliedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
  discount: { type: Number, default: 0 },
  finalTotal: { type: Number, default: 0 }
}, { timestamps: true });

// Pre-save hook to calculate totals
cartSchema.pre('save', function(next) {
  this.items.forEach(item => {
    item.total = Number(item.price) * Number(item.quantity);
  });

  this.total = this.items.reduce((acc, item) => acc + item.total, 0);
  this.finalTotal = this.total - (this.discount ?? 0);

  next();
});

module.exports = mongoose.model('Cart', cartSchema);
