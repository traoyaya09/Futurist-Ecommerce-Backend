const mongoose = require('mongoose');
const Product = require('./ProductModel');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },   // optional now
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // fallback
  quantity: { type: Number, default: 1, required: true },
  price: { type: Number, required: true },
  total: { type: Number }
}, { _id: true });

// Pre-save hook: ensure product is always set
cartItemSchema.pre('save', function(next) {
  if (!this.product && this.product_id) {
    this.product = this.product_id;
  }
  next();
});

const savedItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
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

// -------------------------
// Pre-save hook to recalc totals
// -------------------------
cartSchema.pre('save', function(next) {
  this.items.forEach(i => {
    // fallback product fix
    if (!i.product && i.product_id) i.product = i.product_id;

    i.total = Number(i.price) * Number(i.quantity);
  });

  this.total = this.items.reduce((acc, item) => acc + item.total, 0);
  this.finalTotal = this.total - (this.discount ?? 0);
  next();
});

module.exports = mongoose.model('Cart', cartSchema);
