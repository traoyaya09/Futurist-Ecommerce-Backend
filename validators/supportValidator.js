const { check } = require('express-validator');

// Validator for creating a new support ticket
const createSupportTicketValidation = [
  check('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 3 })
    .withMessage('Subject must be at least 3 characters long'),

  check('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10 })
    .withMessage('Message must be at least 10 characters long'),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator for updating a support ticket
const updateSupportTicketValidation = [
  check('subject')
    .optional()
    .isLength({ min: 3 })
    .withMessage('Subject must be at least 3 characters long'),

  check('message')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Message must be at least 10 characters long'),

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
  createSupportTicketValidation,
  updateSupportTicketValidation,
};
