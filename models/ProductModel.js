const mongoose = require('mongoose');
const { normalizeIncomingProduct } = require('../utils/adaptProduct');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, maxlength: 500, default: 'No description available' },
  price: { type: Number, min: 0, default: null },          // actual_price
  discountPrice: { type: Number, min: 0, default: null },  // discount_price
  category: { type: String, trim: true, default: 'Uncategorized' },
  subCategory: { type: String, trim: true, default: '' },
  brand: { type: String, trim: true, default: '' },
  stock: { type: Number, min: 0, default: 0 },
  imageUrl: { type: String, default: 'https://via.placeholder.com/150' },
  link: { type: String, trim: true, default: '' },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewsCount: { type: Number, min: 0, default: 0 },
  reviews: { type: Array, default: [] },
  isFeatured: { type: Boolean, default: false },
  promotion: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for API
ProductSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

// Static normalize
ProductSchema.statics.normalizeIncoming = function(raw) {
  return normalizeIncomingProduct(raw);
};

module.exports = mongoose.model('Product', ProductSchema);
