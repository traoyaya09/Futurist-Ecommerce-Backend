const Review = require('../models/ReviewModel');
const Product = require('../models/ProductModel');
const { validationResult } = require('express-validator');
const { getSocketInstance } = require('../socket');

const reviewController = {
  // Add a new review
  addReview: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, userId, rating, comment } = req.body;

      // Check if the product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Check if the user already reviewed the product
      const existingReview = await Review.findOne({ productId, userId });
      if (existingReview) {
        return res.status(400).json({ message: 'You have already reviewed this product' });
      }

      // Create the new review
      const review = new Review({
        productId,
        userId,
        rating,
        comment: comment.trim()
      });
      await review.save();

      // Update the product's average rating
      const avgRating = await Review.getAverageRating(productId);
      product.averageRating = avgRating.toFixed(2);
      await product.save();

      // Emit socket event for new review added
      const io = getSocketInstance();
      io.emit('review:added', review);

      res.status(201).json({ message: 'Review added successfully', review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get reviews by product with pagination, sorting, and filtering
  getReviewsByProduct: async (req, res) => {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10, sort = 'createdAt_desc' } = req.query;

      const sortOptions = {};
      if (sort === 'rating_asc') {
        sortOptions.rating = 1;
      } else if (sort === 'rating_desc') {
        sortOptions.rating = -1;
      } else if (sort === 'date_asc') {
        sortOptions.createdAt = 1;
      } else if (sort === 'date_desc') {
        sortOptions.createdAt = -1;
      }

      const reviews = await Review.find({ productId })
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate('userId', 'name');

      const totalReviews = await Review.countDocuments({ productId });
      const avgRating = await Review.getAverageRating(productId);

      res.status(200).json({
        totalReviews,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReviews / limit),
        avgRating,
        reviews
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update an existing review
  updateReview: async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { rating, comment } = req.body;

      const review = await Review.findByIdAndUpdate(
        reviewId,
        { $set: { rating, comment: comment.trim() } },
        { new: true, runValidators: true }
      );
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Update the product's average rating after the review is updated
      const avgRating = await Review.getAverageRating(review.productId);
      await Product.findByIdAndUpdate(review.productId, { averageRating: avgRating.toFixed(2) });

      // Emit socket event for review update
      const io = getSocketInstance();
      io.emit('review:updated', review);

      res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Delete a review
  deleteReview: async (req, res) => {
    try {
      const { reviewId } = req.params;

      const review = await Review.findByIdAndDelete(reviewId);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Update the product's average rating after the review is deleted
      const avgRating = await Review.getAverageRating(review.productId);
      await Product.findByIdAndUpdate(review.productId, { averageRating: avgRating.toFixed(2) });

      // Emit socket event for review deletion
      const io = getSocketInstance();
      io.emit('review:deleted', reviewId);

      res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get all reviews (admin-only route)
  getAllReviews: async (req, res) => {
    try {
      const reviews = await Review.find()
        .populate('productId', 'name')
        .populate('userId', 'name');
      res.status(200).json({ reviews });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get review by ID (either user or admin)
  getReviewById: async (req, res) => {
    try {
      const { reviewId } = req.params;
      const review = await Review.findById(reviewId)
        .populate('productId', 'name')
        .populate('userId', 'name');
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }
      res.status(200).json({ review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = reviewController;
