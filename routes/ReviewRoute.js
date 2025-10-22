const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/ReviewController');
const { validateReviewRequest, validateReviewUpdate } = require('../middleware/validation');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Add a review (protected route, user only)
router.post('/', authenticate, validateReviewRequest, reviewController.addReview);

// Get reviews for a product (public route)
router.get('/product/:productId', reviewController.getReviewsByProduct);

// Update a review (protected route, user only)
router.put('/:reviewId', authenticate, validateReviewUpdate, reviewController.updateReview);

// Delete a review (protected route, user only)
router.delete('/:reviewId', authenticate, reviewController.deleteReview);

// Get all reviews (admin only route)
router.get('/', authenticate, authorize('Admin'), reviewController.getAllReviews);

// Get a specific review by ID (protected route, admin or user)
router.get('/:reviewId', authenticate, reviewController.getReviewById);

module.exports = router;