const { check } = require('express-validator');

// Validator for creating a transaction
const validateTransactionCreation = [
  check('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a valid number greater than or equal to 0'),

  check('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  check('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['Credit Card', 'PayPal', 'Bank Transfer', 'Cash']).withMessage('Invalid payment method'),
  
  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator for updating a transaction
const validateTransactionUpdate = [
  check('status')
    .optional()
    .isIn(['Pending', 'Completed', 'Failed']).withMessage('Invalid status value'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = {
  validateTransactionCreation,
  validateTransactionUpdate
};
