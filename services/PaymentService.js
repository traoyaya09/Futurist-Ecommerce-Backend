const paypal = require('paypal-rest-sdk');
const dotenv = require('dotenv');
const Payment = require('../models/PaymentModel');
const Order = require('../models/OrderModel');

dotenv.config();

// ✅ Configure PayPal SDK
paypal.configure({
  mode: 'sandbox', // Change to 'live' in production
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_SECRET,
});

const PaymentService = {
  /**
   * ✅ Process Payment (Cash, PayPal, Credit Card, Bank, Crypto)
   * @param {Object} paymentData - Contains userId, orderId, amount, paymentMethod, and optional cardInfo
   * @returns {Object} - Success response or failure message
   */
  processPayment: async ({ userId, orderId, amount, paymentMethod, cardInfo = null }) => {
    try {
      // ✅ Fetch Order
      const order = await Order.findById(orderId);
      if (!order) throw new Error('Order not found');

      // ✅ Validate Payment Amount
      if (amount !== order.totalAmount) throw new Error('Payment amount does not match order total');

      let transactionId = null;
      let paymentStatus = 'Pending';

      // ✅ Handle PayPal or Credit Card Payments
      if (paymentMethod === 'PayPal' || paymentMethod === 'Credit Card') {
        const paymentData = {
          intent: 'sale',
          payer: { payment_method: paymentMethod === 'Credit Card' ? 'credit_card' : 'paypal' },
          transactions: [{ 
            amount: { total: amount.toFixed(2), currency: order.currency }, 
            description: `Order ${orderId}` 
          }],
          redirect_urls: {
            return_url: `${process.env.PAYPAL_RETURN_URL}`,
            cancel_url: `${process.env.PAYPAL_CANCEL_URL}`,
          },
        };

        if (paymentMethod === 'Credit Card') {
          if (!cardInfo) throw new Error('Card details are required for credit card payments');
          paymentData.payer.funding_instruments = [{ credit_card: { ...cardInfo } }];
        }

        const payment = await new Promise((resolve, reject) => {
          paypal.payment.create(paymentData, (error, payment) => {
            if (error) return reject(error);
            resolve(payment);
          });
        });

        transactionId = payment.id;
        paymentStatus = 'Pending';

        if (paymentMethod === 'PayPal') {
          return {
            approvalUrl: payment.links.find(link => link.rel === 'approval_url').href,
            transactionId,
          };
        }
      }

      // ✅ Record Payment in Database
      const newPayment = await Payment.create({
        userId,
        order: orderId,
        amount,
        method: paymentMethod,
        status: paymentStatus,
        transactionId,
      });

      return { success: true, payment: newPayment };
    } catch (error) {
      console.error('Payment Processing Error:', error.message);
      return { success: false, message: error.message };
    }
  },

  /**
   * ✅ Execute PayPal Payment After User Approval
   * @param {String} paymentId - PayPal Payment ID
   * @param {String} payerId - PayPal Payer ID
   * @returns {Object} - Success response or failure message
   */
  executePayment: async (paymentId, payerId) => {
    try {
      const payment = await new Promise((resolve, reject) => {
        paypal.payment.execute(paymentId, { payer_id: payerId }, (error, payment) => {
          if (error) return reject(error);
          resolve(payment);
        });
      });

      await Payment.findOneAndUpdate({ transactionId: payment.id }, { status: 'Processed' });
      return { success: true, message: 'Payment successful', payment };
    } catch (error) {
      console.error('Payment Execution Error:', error.message);
      return { success: false, message: error.message };
    }
  },

  /**
   * ✅ Refund a Processed Payment (Requires Admin Approval)
   * @param {String} paymentId - The ID of the payment to be refunded
   * @returns {Object} - Success response or failure message
   */
  refundPayment: async (paymentId) => {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) throw new Error('Payment not found');

      if (payment.status !== 'Processed') throw new Error('Only successful payments can be refunded');

      payment.status = 'Refunded';
      payment.refundDate = new Date();
      await payment.save();

      await Order.findByIdAndUpdate(payment.order, { status: 'refund_issued' });

      return { success: true, message: 'Payment refunded successfully', payment };
    } catch (error) {
      console.error('Refund Error:', error.message);
      return { success: false, message: error.message };
    }
  },

  /**
   * ✅ Get Payment Status by Order ID
   * @param {String} orderId - The order ID linked to the payment
   * @returns {Object} - Payment status details
   */
  getPaymentStatus: async (orderId) => {
    try {
      const payment = await Payment.findOne({ order: orderId });

      if (!payment) throw new Error('Payment not found for the given order');

      return {
        status: payment.status,
        paymentMethod: payment.method,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        failureReason: payment.failureReason || null,
      };
    } catch (error) {
      console.error('Error getting payment status:', error.message);
      return { success: false, message: 'Error getting payment status' };
    }
  },

  /**
   * ✅ Log Payment for Auditing
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID
   * @param {Number} amount - Payment amount
   * @param {String} method - Payment method
   * @param {String} status - Payment status
   */
  logPayment: async (orderId, userId, amount, method, status) => {
    try {
      await Payment.create({ order: orderId, userId, amount, method, status });
      console.log(`✅ Payment logged for Order: ${orderId}`);
    } catch (error) {
      console.error('Error logging payment:', error.message);
    }
  },
};

module.exports = PaymentService;
