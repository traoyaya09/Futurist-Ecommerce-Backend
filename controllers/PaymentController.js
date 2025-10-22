const Payment = require('../models/PaymentModel');
const Order = require('../models/OrderModel');
const User = require('../models/UserModel');
const { processPayment, capturePayment, refundPayment, getPaymentStatus } = require('../helpers/PaymentHelper');
const { getSocketInstance } = require('../socket');

const paymentController = {
  /**
   * ✅ Process a payment for an order (PayPal, Credit Card, Bank Transfer, Cash)
   */
  processPayment: async (req, res) => {
    try {
      const { userId, orderId, amount, paymentMethod, currency, cardInfo } = req.body;

      // Validate user & order
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      // Process Payment via Helper
      const paymentResult = await processPayment({ userId, orderId, amount, paymentMethod, currency, cardInfo });

      if (!paymentResult.success) {
        return res.status(400).json({ message: paymentResult.message });
      }

      // Emit socket event for processed payment
      const io = getSocketInstance();
      io.emit('payment:processed', paymentResult.payment);

      res.status(200).json({ message: 'Payment processed successfully', payment: paymentResult.payment });
    } catch (error) {
      console.error('Error processing payment:', error.message);
      res.status(500).json({ message: 'Error processing payment', error: error.message });
    }
  },

  /**
   * ✅ Capture an Approved PayPal Payment
   */
  capturePayment: async (req, res) => {
    try {
      const { paymentId } = req.query;
      const result = await capturePayment(paymentId);
      if (!result.success) return res.status(400).json({ message: result.message });

      // Emit socket event for captured payment
      const io = getSocketInstance();
      io.emit('payment:captured', { paymentId, result });

      res.status(200).json({ message: 'Payment captured successfully' });
    } catch (error) {
      console.error('Error capturing payment:', error.message);
      res.status(500).json({ message: 'Error capturing payment', error: error.message });
    }
  },

  /**
   * ✅ Refund a Payment (Admin Only)
   */
  refundPayment: async (req, res) => {
    try {
      const { paymentId } = req.params;
      const refundResult = await refundPayment(paymentId);
      if (!refundResult.success) return res.status(400).json({ message: refundResult.message });

      // Emit socket event for refunded payment
      const io = getSocketInstance();
      io.emit('payment:refunded', { paymentId, refund: refundResult });

      res.status(200).json({ message: 'Payment refunded successfully', refund: refundResult });
    } catch (error) {
      console.error('Error processing refund:', error.message);
      res.status(500).json({ message: 'Error processing refund', error: error.message });
    }
  },

  /**
   * ✅ Get Payment Status for an Order
   */
  getPaymentStatus: async (req, res) => {
    try {
      const { orderId } = req.params;
      const status = await getPaymentStatus(orderId);
      if (!status.success) return res.status(404).json({ message: status.message });

      res.status(200).json(status);
    } catch (error) {
      console.error('Error fetching payment status:', error.message);
      res.status(500).json({ message: 'Error fetching payment status', error: error.message });
    }
  },

  /**
   * ✅ Get Payment Details by Payment ID
   */
  getPaymentDetails: async (req, res) => {
    try {
      const { paymentId } = req.params;
      const payment = await Payment.findById(paymentId);
      if (!payment) return res.status(404).json({ message: 'Payment not found' });
      res.status(200).json(payment);
    } catch (error) {
      console.error('Error fetching payment details:', error.message);
      res.status(500).json({ message: 'Error fetching payment details', error: error.message });
    }
  },

  /**
   * ✅ Split Payment Among Multiple Recipients (Admin Only)
   */
  splitPayment: async (req, res) => {
    try {
      const { orderId, recipients } = req.body;
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (recipients.length === 0) return res.status(400).json({ message: 'Recipients list cannot be empty' });

      // Calculate split amount
      const splitAmount = order.totalAmount / recipients.length;

      // Process payments for each recipient
      const payments = await Promise.all(recipients.map(async (recipient) => {
        return Payment.create({
          userId: recipient.userId,
          orderId,
          amount: splitAmount,
          method: 'Split Payment',
          status: 'Processed',
          paymentDate: new Date()
        });
      }));

      // Emit socket event for split payments
      const io = getSocketInstance();
      io.emit('payment:split', { orderId, payments });

      res.status(200).json({ message: 'Payments split successfully', payments });
    } catch (error) {
      console.error('Error processing split payment:', error.message);
      res.status(500).json({ message: 'Error processing split payment', error: error.message });
    }
  },

  /**
   * ✅ Initiate Refund Request (Admin Only)
   */
  initiateRefund: async (req, res) => {
    try {
      const { userId, orderId } = req.body;

      const user = await User.findById(userId);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Unauthorized. Only admins can initiate refunds' });
      }

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (order.status !== 'Paid') {
        return res.status(400).json({ message: 'Only paid orders can be refunded' });
      }

      // Mark order for refund processing
      order.status = 'Refund Pending';
      await order.save();

      // Emit socket event for initiating refund
      const io = getSocketInstance();
      io.emit('refund:initiated', { orderId, status: order.status });

      res.status(200).json({ message: 'Refund initiated successfully', order });
    } catch (error) {
      console.error('Error initiating refund:', error.message);
      res.status(500).json({ message: 'Error initiating refund', error: error.message });
    }
  }
};

module.exports = paymentController;
