const Review = require('../models/ReviewModel');

// Add a new review
const addReview = async (reviewData) => {
  try {
      const newReview = new Review(reviewData);
      await newReview.save();
      return newReview;
  } catch (error) {
      console.error('Error adding review:', error);
      throw new Error('Error adding review');
  }
};

// Get reviews by product with pagination and sorting
const getReviewsByProduct = async (productId, page = 1, limit = 10, sort = 'date_desc') => {
  try {
      const sortOptions = {};
      
      // Sorting based on provided sort option
      switch (sort) {
        case 'rating_asc':
          sortOptions.rating = 1;
          break;
        case 'rating_desc':
          sortOptions.rating = -1;
          break;
        case 'date_asc':
          sortOptions.createdAt = 1;
          break;
        case 'date_desc':
        default:
          sortOptions.createdAt = -1;
          break;
      }

      const reviews = await Review.find({ productId })
          .sort(sortOptions)
          .limit(limit)
          .skip((page - 1) * limit);

      const totalReviews = await Review.countDocuments({ productId });

      return {
          totalReviews,
          reviews,
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit)
      };
  } catch (error) {
      console.error('Error fetching product reviews:', error);
      throw new Error('Error fetching product reviews');
  }
};

// Update an existing review
const updateReview = async (reviewId, rating, comment) => {
  try {
      const review = await Review.findByIdAndUpdate(
          reviewId,
          { rating, comment },
          { new: true, runValidators: true }
      );
      if (!review) throw new Error('Review not found');
      return review;
  } catch (error) {
      console.error('Error updating review:', error);
      throw new Error('Error updating review');
  }
};

// Delete a review
const deleteReview = async (reviewId) => {
  try {
      const review = await Review.findByIdAndDelete(reviewId);
      if (!review) throw new Error('Review not found');
      return review;
  } catch (error) {
      console.error('Error deleting review:', error);
      throw new Error('Error deleting review');
  }
};

module.exports = { addReview, getReviewsByProduct, updateReview, deleteReview };
