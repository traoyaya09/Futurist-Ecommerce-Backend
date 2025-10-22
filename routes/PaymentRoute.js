const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');
const { validatePayment, validateRefund } = require('../middleware/validation');

// ✅ Process a payment (Cash, PayPal, Credit Card, Bank, Crypto)
router.post('/process', authenticate, validatePayment, paymentController.processPayment);

// ✅ Capture a PayPal Payment (After User Approval)
router.get('/capture', authenticate, paymentController.capturePayment);

// ✅ Refund a payment (Requires Admin Approval)
router.put('/:paymentId/refund', authenticate, authorize('Admin'), validateRefund, paymentController.refundPayment);

// ✅ Get Payment Status for an Order
router.get('/status/:orderId', authenticate, paymentController.getPaymentStatus);

// ✅ Get Payment Details by Payment ID
router.get('/:paymentId', authenticate, paymentController.getPaymentDetails);

// ✅ Split Payment Among Multiple Recipients (Admin Only)
router.post('/split', authenticate, authorize('Admin'), paymentController.splitPayment);

// ✅ Initiate Refund Request (Admin Only)
router.put('/refund/initiate', authenticate, authorize('Admin'), paymentController.initiateRefund);

module.exports = router;
