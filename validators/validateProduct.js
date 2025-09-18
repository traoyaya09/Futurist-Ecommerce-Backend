const { check, validationResult } = require('express-validator');

// Validation for product creation and update
const validateProduct = [
  // Validate that the name is provided and is between 3 and 100 characters
  check('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Product name must be between 3 and 100 characters'),

  // Validate that the price is provided and is a positive number
  check('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),

  // Validate that the description is optional but if provided, it should be within the max length
  check('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description can be at most 1000 characters long'),

  // Validate that the category is a valid MongoDB ObjectId
  check('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID format'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateProduct };
