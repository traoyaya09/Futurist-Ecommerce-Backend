const { check, validationResult } = require('express-validator');

// Validator for return request
const validateReturnRequest = [
  check('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format'),
  
  check('orderId')
    .notEmpty().withMessage('Order ID is required')
    .isMongoId().withMessage('Invalid Order ID format'),
  
  check('productId')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Invalid Product ID format'),

  check('reason')
    .notEmpty().withMessage('Reason is required')
    .isLength({ min: 10 }).withMessage('Reason must be at least 10 characters long'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator for processing a return
const validateReturnProcess = [
  check('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['Approved', 'Rejected', 'Processed']).withMessage('Invalid status value'),
  
  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateReturnRequest, validateReturnProcess };
