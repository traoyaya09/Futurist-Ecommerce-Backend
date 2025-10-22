const { check, validationResult } = require('express-validator');

/**
 * Validation middleware for creating an order
 * Ensures items, paymentMethod, shippingAddress, and totals are valid
 */
const validateOrderCreation = [
  check('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),

  check('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),

  check('items.*.product')
    .isMongoId()
    .withMessage('Each item must have a valid product ID'),
  check('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item must have a quantity of at least 1'),
  check('items.*.price')
    .isFloat({ gt: 0 })
    .withMessage('Each item must have a positive price'),

  check('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['Credit Card', 'PayPal', 'Cash on Delivery', 'Bank Transfer'])
    .withMessage('Invalid payment method'),

  check('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required')
    .custom(addr => typeof addr === 'object')
    .withMessage('Shipping address must be an object')
    .custom(addr => !!addr.country)
    .withMessage('Shipping address must include a country'),

  // handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateOrderCreation };
