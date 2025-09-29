// models/Product.js
const mongoose = require('mongoose');
const { adaptProduct } = require('../utils/adaptProduct');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [500, 'Product description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    default: null
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    trim: true
  },
  subCategory: {
    type: String,
    trim: true,
    default: ''
  },
  brand: {
    type: String,
    trim: true,
    default: ''
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  imageUrl: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  link: {
    type: String,
    trim: true,
    default: ''
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewsCount: {
    type: Number,
    min: 0,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for faster queries
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

// -------------------------
// Static method to normalize incoming raw data
// -------------------------
ProductSchema.statics.normalizeIncoming = function(raw) {
  const adapted = adaptProduct(raw);

  return {
    name: adapted.name,
    description: adapted.description,
    price: adapted.price,
    discountPrice: adapted.discountPrice,
    category: adapted.category,
    subCategory: adapted.subCategory || raw.sub_category || '',
    brand: adapted.brand,
    stock: adapted.stock ?? 0,
    imageUrl: adapted.imageUrl,
    link: adapted.link || raw.link || '',
    rating: adapted.rating,
    reviewsCount: adapted.reviewsCount,
    isFeatured: raw.isFeatured ?? false,
    createdAt: raw.createdAt || undefined,
  };
};

module.exports = mongoose.model('Product', ProductSchema);
