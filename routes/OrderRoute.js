const express = require('express');
const router = express.Router();
const Order = require('../models/OrderModel');
const { cancelOrder } = require('../helpers/OrderHelper');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');
const { validateOrderCreation } = require('../validators/orderValidator');
const { getSocketInstance } = require('../socket'); // Import the socket instance

// Create a new order (Requires sign-in and order validation)
router.post('/', authenticate, validateOrderCreation, async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();

    // Emit the order creation event via socket
    const io = getSocketInstance();
    io.emit('orderCreated', order); // Notify clients about the new order

    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all orders with pagination and filtering (Admin Only)
router.get('/', authenticate, authorize('Admin'), async (req, res) => {
  const { page = 1, status = '', searchQuery = '' } = req.query;
  try {
    const orders = await Order.find({
      ...(status && { status }),
      ...(searchQuery && { $text: { $search: searchQuery } }),
    })
      .skip((page - 1) * 10)
      .limit(10);
    const totalOrders = await Order.countDocuments();
    res.json({ orders, totalOrders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete an order by ID (Admin Only)
router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Emit the order deletion event via socket
    const io = getSocketInstance();
    io.emit('orderDeleted', order.id); // Notify clients about the deleted order

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status (Admin Only)
router.patch('/:id/status', authenticate, authorize('Admin'), async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Emit the order status update event via socket
    const io = getSocketInstance();
    io.emit('orderUpdated', updatedOrder); // Notify clients about the updated order

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single order by ID (Authenticated User)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel an order (User or Admin only)
router.delete('/:orderId/cancel', authenticate, async (req, res) => {
  const { orderId } = req.params;
  try {
    const canceledOrder = await cancelOrder(orderId, req.user._id);
    if (!canceledOrder) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled' });
    }

    // Emit the order cancel event via socket
    const io = getSocketInstance();
    io.emit('orderCanceled', canceledOrder); // Notify clients about the canceled order

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;