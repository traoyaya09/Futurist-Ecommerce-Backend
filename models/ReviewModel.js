const mongoose = require('mongoose');

// Define the review schema
const reviewSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true, 
    index: true // Index for performance optimization when querying by product
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true // Index for performance optimization when querying by user
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5, // Ensuring the rating is between 1 and 5
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not a valid integer rating'
    }
  },
  comment: { 
    type: String, 
    maxlength: 500, // Maximum length for the comment field
    trim: true // Trim any extra spaces
  }
}, { 
  timestamps: true // Automatically add createdAt and updatedAt fields
});

// Prevent users from reviewing the same product more than once
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Define a static method to get average rating of a product
reviewSchema.statics.getAverageRating = async function(productId) {
  const result = await this.aggregate([
    { $match: { productId: mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$productId', avgRating: { $avg: '$rating' } } }
  ]);
  return result[0] ? result[0].avgRating : 0;
};

// Define a pre-remove hook to handle any actions before deleting a review
reviewSchema.pre('remove', async function(next) {
  // Add any logic you want to run before deleting a review
  // For example, updating the product's average rating or other fields
  next();
});

// Export the review model
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
