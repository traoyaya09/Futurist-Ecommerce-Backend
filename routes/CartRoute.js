const express = require('express');
const router = express.Router();
const cartController = require('../controllers/CartController');

// -------------------------
// Cart routes
// -------------------------

// Get user's cart
// GET /carts/:userId
router.get('/:userId', cartController.getCart);

// Add or update product in cart
// POST /carts/:userId/product
router.post('/:userId/product', cartController.addOrUpdateProduct);

// Remove product from cart
// DELETE /carts/:userId/product/:productId
router.delete('/:userId/product/:productId', cartController.removeProduct);

// Save product for later
// POST /carts/:userId/product/:productId/save
router.post('/:userId/product/:productId/save', cartController.saveProductForLater);

// Merge guest cart into user's cart
// POST /carts/:userId/merge
router.post('/:userId/merge', cartController.mergeCarts);

// Checkout
// POST /carts/:userId/checkout
router.post('/:userId/checkout', cartController.checkout);

// Apply promotion
// POST /carts/:userId/promotion
router.post('/:userId/promotion', cartController.applyPromotion);

// Apply discount
// POST /carts/:userId/discount
router.post('/:userId/discount', cartController.applyDiscount);

module.exports = router;
