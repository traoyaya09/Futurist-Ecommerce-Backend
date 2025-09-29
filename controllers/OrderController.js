const OrderService = require('../services/OrderService');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../services/EmailService');
const { getSocketInstance } = require('../socket');
const User = require('../models/UserModel');

const orderController = {
  createOrder: async (req, res) => {
    try {
      const { userId, items, paymentMethod, shippingAddress } = req.body;

      const { order, shipments } = await OrderService.createOrder({ userId, items, paymentMethod, shippingAddress });

      // Emit socket
      const io = getSocketInstance();
      io.emit('order:created', order);

      // Send email
      const user = await User.findById(userId);
      await sendOrderConfirmationEmail(user, order);

      res.status(201).json({ message: 'Order created successfully', order, shipments });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  },

  updateOrderStatus: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const order = await OrderService.updateOrderStatus(orderId, status);

      const user = await User.findById(order.userId);
      await sendOrderStatusUpdateEmail(user, order);

      const io = getSocketInstance();
      io.emit('order:statusUpdated', order);

      res.status(200).json({ message: 'Order status updated successfully', order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  },

  cancelOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await OrderService.cancelOrder(orderId);

      const io = getSocketInstance();
      io.emit('order:canceled', order);

      res.status(200).json({ message: 'Order cancelled successfully', order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  },

  getUserOrders: async (req, res) => {
    try {
      const { userId } = req.params;
      const orders = await OrderService.getUserOrders(userId);
      res.status(200).json({ success: true, orders });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  },

  getAllOrders: async (req, res) => {
    try {
      const { page = 1, status = '', searchQuery = '' } = req.query;
      const result = await OrderService.getAllOrders(page, status, searchQuery);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  }
};

module.exports = orderController;
