const express = require('express');
const router = express.Router();
const cartController = require('../controllers/CartController');

// -------------------------
// Cart routes
// -------------------------

// Get user's cart
// GET /cart/:userId
router.get('/:userId', cartController.getCart);

// Add or update product in cart
// POST /cart/:userId/product
router.post('/:userId/product', cartController.addOrUpdateProduct);

// Remove product from cart
// DELETE /cart/:userId/product/:id
router.delete('/:userId/product/:id', cartController.removeProduct);

// Save product for later
// POST /cart/:userId/product/:id/save
router.post('/:userId/product/:id/save', cartController.saveProductForLater);

// Merge guest cart into user's cart
// POST /cart/:userId/merge
router.post('/:userId/merge', cartController.mergeCarts);

// Checkout
// POST /cart/:userId/checkout
router.post('/:userId/checkout', cartController.checkout);

// Apply promotion
// POST /cart/:userId/promotion
router.post('/:userId/promotion', cartController.applyPromotion);

// Apply discount
// POST /cart/:userId/discount
router.post('/:userId/discount', cartController.applyDiscount);

module.exports = router;
