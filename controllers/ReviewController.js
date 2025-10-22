const mongoose = require('mongoose');
const Review = require('../models/ReviewModel');
const Product = require('../models/ProductModel');
const { validationResult } = require('express-validator');
const { getSocketInstance } = require('../socket');

// -------------------------
// Helper: safely convert to ObjectId
// -------------------------
const toObjectId = (id, name = 'id') => {
  if (!id) throw new Error(`Invalid ${name}: empty value`);
  if (mongoose.isValidObjectId(id)) return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
  throw new Error(`Invalid ${name}: ${id}`);
};

// -------------------------
// Review Controller
// -------------------------
const reviewController = {
  // Add a new review
  addReview: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { productId, userId, rating, comment } = req.body;
      const pid = toObjectId(productId, 'productId');
      const uid = toObjectId(userId, 'userId');

      const product = await Product.findById(pid);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      const existingReview = await Review.findOne({ productId: pid, userId: uid });
      if (existingReview) return res.status(400).json({ message: 'You have already reviewed this product' });

      const review = new Review({ productId: pid, userId: uid, rating, comment: comment.trim() });
      await review.save();

      const avgRating = await Review.getAverageRating(pid);
      product.averageRating = avgRating.toFixed(2);
      await product.save();

      getSocketInstance().emit('review:added', review);

      res.status(201).json({ message: 'Review added successfully', review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get reviews by product
  getReviewsByProduct: async (req, res) => {
    try {
      const pid = toObjectId(req.params.productId, 'productId');
      const { page = 1, limit = 10, sort = 'createdAt_desc' } = req.query;

      const sortOptions = {};
      if (sort === 'rating_asc') sortOptions.rating = 1;
      else if (sort === 'rating_desc') sortOptions.rating = -1;
      else if (sort === 'date_asc') sortOptions.createdAt = 1;
      else sortOptions.createdAt = -1;

      const reviews = await Review.find({ productId: pid })
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate('userId', 'name');

      const totalReviews = await Review.countDocuments({ productId: pid });
      const avgRating = await Review.getAverageRating(pid);

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

  // Update review
  updateReview: async (req, res) => {
    try {
      const rid = toObjectId(req.params.reviewId, 'reviewId');
      const { rating, comment } = req.body;

      const review = await Review.findByIdAndUpdate(
        rid,
        { $set: { rating, comment: comment.trim() } },
        { new: true, runValidators: true }
      );
      if (!review) return res.status(404).json({ message: 'Review not found' });

      const avgRating = await Review.getAverageRating(review.productId);
      await Product.findByIdAndUpdate(review.productId, { averageRating: avgRating.toFixed(2) });

      getSocketInstance().emit('review:updated', review);

      res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Delete review
  deleteReview: async (req, res) => {
    try {
      const rid = toObjectId(req.params.reviewId, 'reviewId');

      const review = await Review.findByIdAndDelete(rid);
      if (!review) return res.status(404).json({ message: 'Review not found' });

      const avgRating = await Review.getAverageRating(review.productId);
      await Product.findByIdAndUpdate(review.productId, { averageRating: avgRating.toFixed(2) });

      getSocketInstance().emit('review:deleted', rid);

      res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get all reviews
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

  // Get review by ID
  getReviewById: async (req, res) => {
    try {
      const rid = toObjectId(req.params.reviewId, 'reviewId');
      const review = await Review.findById(rid)
        .populate('productId', 'name')
        .populate('userId', 'name');
      if (!review) return res.status(404).json({ message: 'Review not found' });
      res.status(200).json({ review });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = reviewController;
