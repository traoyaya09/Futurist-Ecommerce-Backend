const { check, validationResult } = require('express-validator');

const validateOrderCreation = [
  // Validate userId (should be a valid MongoDB ObjectId)
  check('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),

  // Validate that items are provided and is an array
  check('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  // Validate each item in the items array
  check('items.*.product')
    .isMongoId()
    .withMessage('Each item must have a valid product ID'),
  check('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item must have a quantity of at least 1'),
  check('items.*.price')
    .isFloat({ gt: 0 })
    .withMessage('Each item must have a positive price'),

  // Validate totalAmount
  check('totalAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Total amount must be greater than zero'),

  // Validate discountAmount (if applicable)
  check('discountAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount amount must be zero or a positive value'),

  // Validate paymentMethod field
  check('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['Credit Card', 'PayPal', 'Cash on Delivery', 'Bank Transfer'])
    .withMessage('Invalid payment method'),

  // Validate shippingAddress field
  check('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required')
    .isString()
    .withMessage('Shipping address must be a string'),

  // Validate estimatedDelivery (if provided)
  check('estimatedDelivery')
    .optional()
    .isISO8601()
    .withMessage('Invalid estimated delivery date format'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateOrderCreation };
