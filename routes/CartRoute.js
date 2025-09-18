const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// Route for adding an item to the cart
router.post('/add', cartController.addToCart);

// Route for removing an item from the cart
router.delete('/remove', cartController.removeFromCart);

// Route for updating cart item quantity
router.put('/update', cartController.updateCartItem);

// Route for fetching the user's cart
router.get('/:userId', cartController.getCart);  // Changed from POST to GET for fetching data
router.get('/', cartController.getCart);  // No userId, but still requires the user to be authenticated or passed some identifier

// Route for checking out
router.post('/checkout/:userId', cartController.checkout);

// Route for applying a promotion code
router.post('/promotion/apply', cartController.applyPromotion);

// Route for saving an item for later
router.post('/saveForLater', cartController.saveForLater);

// Route for merging guest cart with user cart
router.post('/merge', cartController.mergeCarts);

// Route for applying a discount code
router.post('/discount/apply', cartController.applyDiscount);

module.exports = router;
