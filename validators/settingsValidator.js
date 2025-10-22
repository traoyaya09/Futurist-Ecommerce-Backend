const { check, validationResult } = require('express-validator');

const validateSetting = [
  // Validate that the key is provided and is a non-empty string
  check('key')
    .notEmpty()
    .withMessage('Key is required')
    .isString()
    .withMessage('Key must be a string'),

  // Validate that the value is provided and is a string (or number, depending on your requirement)
  check('value')
    .notEmpty()
    .withMessage('Value is required')
    .isString()
    .withMessage('Value must be a string'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateSetting };
