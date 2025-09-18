const mongoose = require('mongoose');

// Define the schema for each item in the cart
const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, required: true },
  price: { type: Number, required: true },  // To store product price at the time of adding to cart
  total: { type: Number },  // Automatically calculated as quantity * price
}, { _id: false });

// Define the schema for saved items (if you want users to save products for later)
const savedItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  addedAt: { type: Date, default: Date.now }
});

// Define the schema for the cart
const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [cartItemSchema],  // Array of items currently in the cart
  savedItems: [savedItemSchema],  // Array of items saved for later
  total: { type: Number, default: 0 },  // Automatically calculated from items
  appliedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },  // Applied promotion (if any)
  discount: { type: Number, default: 0 },  // Applied discount value
  finalTotal: { type: Number, default: 0 },  // Total after discounts
}, { timestamps: true });

// Pre-save hook to calculate the total and final total
cartSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    // Calculate total from items
    this.total = this.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);

    // Apply any promotion/discount (logic for promotion can be handled in controller)
    this.finalTotal = this.total - this.discount;
  } else {
    this.total = 0;
    this.finalTotal = 0;
  }

  next();
});

// Static method to clear the cart after checkout
cartSchema.statics.clearCart = async function(userId) {
  return this.findOneAndUpdate({ user: userId }, { items: [], total: 0, finalTotal: 0 });
};

// Instance method to calculate and apply discount (can be modified for dynamic discount logic)
cartSchema.methods.applyDiscount = function(discountAmount) {
  this.discount = discountAmount;
  this.finalTotal = this.total - discountAmount;
};

// Instance method to add an item to the cart (handles updating quantity if product already exists)
cartSchema.methods.addItem = function(productId, quantity, price) {
  const existingItemIndex = this.items.findIndex(item => item.product.equals(productId));

  if (existingItemIndex !== -1) {
    // Update quantity and total if item already exists
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].total = this.items[existingItemIndex].quantity * price;
  } else {
    // Add new item to the cart
    this.items.push({ product: productId, quantity, price, total: quantity * price });
  }

  this.save();
};

// Instance method to remove an item from the cart
cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => !item._id.equals(itemId));
  this.save();
};

// Instance method to save an item for later
cartSchema.methods.saveItemForLater = function(itemId) {
  const itemToSave = this.items.find(item => item._id.equals(itemId));

  if (itemToSave) {
    this.savedItems.push({ product: itemToSave.product });
    this.items = this.items.filter(item => !item._id.equals(itemId));
    this.save();
  }
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
