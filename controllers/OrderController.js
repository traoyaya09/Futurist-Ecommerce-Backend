const OrderService = require('../services/OrderService');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../services/EmailService');
const User = require('../models/UserModel');

const orderController = {
  // Create a new order
  createOrder: async (req, res) => {
    try {
      const { userId, items, paymentMethod, shippingAddress } = req.body;

      // Delegate to service
      const order = await OrderService.createOrder({ userId, items, paymentMethod, shippingAddress });

      // Send confirmation email
      const user = await User.findById(userId);
      if (user) await sendOrderConfirmationEmail(user, order);

      res.status(201).json({ message: 'Order created successfully', order });
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message || 'Failed to create order' });
    }
  },

  // Update order status
  updateOrderStatus: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const order = await OrderService.updateOrderStatus(orderId, status);

      const user = await User.findById(order.userId);
      if (user) await sendOrderStatusUpdateEmail(user, order);

      res.status(200).json({ message: 'Order status updated successfully', order });
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message || 'Failed to update order status' });
    }
  },

  // Cancel an order
  cancelOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await OrderService.cancelOrder(orderId);
      res.status(200).json({ message: 'Order cancelled successfully', order });
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message || 'Failed to cancel order' });
    }
  },

  // Get orders for a specific user
  getUserOrders: async (req, res) => {
    try {
      const { userId } = req.params;
      const orders = await OrderService.filterOrders({ userId });
      res.status(200).json({ success: true, orders });
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message || 'Failed to fetch orders' });
    }
  },

  // Get all orders with pagination, filtering, and search
  getAllOrders: async (req, res) => {
    try {
      const { page = 1, limit = 20, status = '', shippingStatus = '', searchQuery = '', userId = '' } = req.query;
      const filters = { status, shippingStatus, searchQuery };
      if (userId) filters.userId = userId;

      const result = await OrderService.getAllOrders({
        page: parseInt(page),
        limit: parseInt(limit),
        filters
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message || 'Failed to fetch orders' });
    }
  }
};

module.exports = orderController;
