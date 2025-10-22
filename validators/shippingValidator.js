const { check, validationResult } = require('express-validator');

// Validate shipping creation (tracking numbers no longer required)
const validateShipping = [
  check('address')
    .notEmpty().withMessage('Address is required')
    .isString().withMessage('Address must be a string'),

  check('city')
    .notEmpty().withMessage('City is required')
    .isString().withMessage('City must be a string'),

  check('postalCode')
    .notEmpty().withMessage('Postal code is required')
    .isPostalCode('any').withMessage('Invalid postal code'),

  check('country')
    .notEmpty().withMessage('Country is required')
    .isString().withMessage('Country must be a string'),

  check('method')
    .notEmpty().withMessage('Shipping method is required')
    .isString().withMessage('Shipping method must be a string'),

  check('estimatedDelivery')
    .optional()
    .isISO8601().withMessage('Estimated delivery date must be a valid date'),

  check('packages')
    .isArray({ min: 1 }).withMessage('At least one package is required'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

// Tracking number validation remains for /track/:trackingNumber route
const validateTrackingNumber = [
  check('trackingNumber')
    .notEmpty().withMessage('Tracking number is required')
    .isString().withMessage('Tracking number must be a string'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

module.exports = {
  validateShipping,
  validateTrackingNumber
};
