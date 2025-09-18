const { check, validationResult } = require('express-validator');

// Middleware to handle validation errors from express-validator
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Product validation middleware
const validateProduct = [
  check('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Product name must be between 3 and 100 characters'),

  check('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),

  check('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description can be at most 1000 characters long'),

  check('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID format'),

  handleValidationErrors,
];

// Analytics validation middleware
const validateAnalytics = [
  check('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid User ID format'),

  check('url')
    .notEmpty()
    .withMessage('URL is required')
    .isURL()
    .withMessage('Invalid URL format'),

  handleValidationErrors,
];

// User registration validation middleware
const validateUserRegistration = [
  check('username')
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),

  check('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),

  check('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  handleValidationErrors,
];

// User login validation middleware
const validateUserLogin = [
  check('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),

  check('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors,
];

// Order validation middleware
const validateOrder = [
  check('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid User ID format'),

  check('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid Product ID format'),

  check('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),

  handleValidationErrors,
];

// Info data validation middleware (custom)
const validateInfoData = [
  check('infoField1')
    .notEmpty()
    .withMessage('Info field 1 is required')
    .isString()
    .withMessage('Info field 1 must be a string'),

  check('infoField2')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Info field 2 can be at most 500 characters'),

  handleValidationErrors,
];

// Validation for adding a review
const validateReviewRequest = [
  check('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid Product ID format'),

  check('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),

  check('comment')
    .optional()  // Comment is optional
    .isLength({ max: 500 })
    .withMessage('Comment can be at most 500 characters'),

  handleValidationErrors,  // Handle validation errors
];



const validateReviewUpdate = [
  check('rating')
    .optional()  // Rating is optional during update, but if provided, must be between 1 and 5
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),

  check('comment')
    .optional()  // Comment is optional during update
    .isLength({ max: 500 })
    .withMessage('Comment can be at most 500 characters'),

  handleValidationErrors,  // Handle validation errors
];



// ID param validation middleware (for routes using ObjectId in params)
const validateIdParam = [
  check('id')
    .isMongoId()
    .withMessage('Invalid ID format'),

  handleValidationErrors,
];

// Inventory data validation middleware for creation
const validateInventoryData = [
  check('name')
    .notEmpty()
    .withMessage('Inventory name is required')
    .trim(),

  check('sku')
    .notEmpty()
    .withMessage('SKU is required')
    .trim(),

  check('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a positive integer or zero'),

  check('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a positive integer or zero'),

  check('location')
    .optional()
    .isString()
    .withMessage('Location must be a string'),

  check('stockStatus')
    .optional()
    .isIn(['in-stock', 'low-stock', 'out-of-stock'])
    .withMessage('Stock status must be one of: "in-stock", "low-stock", or "out-of-stock"'),

  handleValidationErrors,
];

// Inventory adjustment validation middleware (increase or decrease quantity)
const validateAdjustment = [
  check('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid Product ID format'),

  check('adjustmentType')
    .notEmpty()
    .withMessage('Adjustment type is required')
    .isIn(['increase', 'decrease'])
    .withMessage('Adjustment type must be either "increase" or "decrease"'),

  check('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),

  handleValidationErrors,
];


// Payment validation middleware
const validatePayment = [
  check('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['credit', 'debit', 'paypal', 'stripe'])
    .withMessage('Invalid payment method'),

  check('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),

  check('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid User ID format'),

  handleValidationErrors,
];

// Refund validation middleware
const validateRefund = [
  check('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required')
    .isMongoId()
    .withMessage('Invalid Payment ID format'),

  check('refundAmount')
    .notEmpty()
    .withMessage('Refund amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Refund amount must be a positive number'),

  check('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Refund reason can be at most 500 characters'),

  handleValidationErrors,
];

module.exports = {
  validateProduct,
  validateAnalytics,
  validateUserRegistration,
  validateUserLogin,
  validateOrder,
  validateInfoData,
  validateIdParam,
  validateInventoryData,
  validateAdjustment,
  validatePayment,
  validateRefund,
  validateReviewRequest, 
  validateReviewUpdate
};
