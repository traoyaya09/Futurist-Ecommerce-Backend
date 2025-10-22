const { body } = require('express-validator');

// Validator for tracking page views
const trackPageViewSchema = [
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format'),
  
  body('url')
    .notEmpty().withMessage('URL is required')
    .isURL().withMessage('Invalid URL format'),
  
  body('referrer')
    .optional()
    .isURL().withMessage('Invalid referrer URL format'),
  
  body('timestamp')
    .optional()
    .isISO8601().withMessage('Timestamp must be a valid ISO 8601 date'),
];

module.exports = {
  trackPageViewSchema,
};
