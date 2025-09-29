const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');
const { validateOrderCreation } = require('../validators/orderValidator');
const orderController = require('../controllers/OrderController');
const { getSocketInstance } = require('../socket');

// Create a new order (Authenticated User)
router.post('/', authenticate, validateOrderCreation, orderController.createOrder);

// Get all orders (Admin only, with optional pagination & filtering)
router.get('/', authenticate, authorize('Admin'), orderController.getAllOrders);

// Get a single order by ID (Authenticated User)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await orderController.getUserOrders(req, res);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

// Cancel an order (User or Admin)
router.delete('/:orderId/cancel', authenticate, orderController.cancelOrder);

// Update order status (Admin only)
router.patch('/:orderId/status', authenticate, authorize('Admin'), orderController.updateOrderStatus);

module.exports = router;
