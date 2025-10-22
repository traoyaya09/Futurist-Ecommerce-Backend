const mongoose = require('mongoose');

// -------------------------
// Review Schema
// -------------------------
const reviewSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true, 
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not a valid integer rating'
    }
  },
  comment: { 
    type: String, 
    maxlength: 500,
    trim: true
  }
}, { 
  timestamps: true
});

// Prevent duplicate reviews by same user for same product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// -------------------------
// Helper: safely convert to ObjectId
// -------------------------
const toObjectId = (id) => {
  if (!id) throw new Error('Invalid ObjectId: empty value');
  if (mongoose.isValidObjectId(id)) return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
  throw new Error(`Invalid ObjectId: ${id}`);
};

// -------------------------
// Static: get average rating
// -------------------------
reviewSchema.statics.getAverageRating = async function(productId) {
  try {
    const pid = toObjectId(productId);

    const result = await this.aggregate([
      { $match: { productId: pid } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' } } }
    ]);

    return result[0] ? result[0].avgRating : 0;
  } catch (error) {
    console.error('[ReviewModel] getAverageRating error:', error.message);
    return 0; // fallback if anything goes wrong
  }
};

// -------------------------
// Pre-remove hook (optional)
// -------------------------
reviewSchema.pre('remove', async function(next) {
  // Add any logic needed before deleting a review, e.g., update product rating
  next();
});

// -------------------------
// Export
// -------------------------
const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
