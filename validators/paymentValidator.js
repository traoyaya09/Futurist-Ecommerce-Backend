const { check, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Payment validation middleware
const validatePayment = [
  // Validate that amount is provided and is a number greater than zero
  check('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than zero'),

  // Validate paymentMethod (assuming certain methods are allowed)
  check('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['Credit Card', 'PayPal', 'Bank Transfer'])
    .withMessage('Invalid payment method'),

  // Optionally, validate the orderId
  check('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Invalid Order ID format'),

  // Handle validation errors
  handleValidationErrors,
];

// Refund validation middleware
const validateRefund = [
  // Validate that paymentId is present and in the correct format
  check('paymentId')
    .isMongoId()
    .withMessage('Invalid Payment ID format'),

  // Optionally validate the refund reason
  check('refundReason')
    .optional()
    .isLength({ min: 5 })
    .withMessage('Refund reason must be at least 5 characters long'),

  // Handle validation errors
  handleValidationErrors,
];

module.exports = { validatePayment, validateRefund };
