const express = require('express');
const {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} = require('../controllers/PromotionController');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

const router = express.Router();

router
  .route('/')
  .get(getPromotions) // Public
  .post(authenticate, authorize('Admin'), createPromotion); // Admin only

router
  .route('/:id')
  .put(authenticate, authorize('Admin'), updatePromotion) // Admin only
  .delete(authenticate, authorize('Admin'), deletePromotion); // Admin only

module.exports = router;