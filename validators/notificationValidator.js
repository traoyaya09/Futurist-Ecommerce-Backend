const { body, param } = require('express-validator');
const mongoose = require('mongoose');

// Validator for sending notifications
const sendNotificationValidation = [
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid User ID format'),
  
  body('message')
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 500 }).withMessage('Message must be between 1 and 500 characters'),

  body('type')
    .optional()
    .isIn(['Order', 'Promotion', 'General']).withMessage('Invalid notification type'),
];

// Validator for validating ID parameters (e.g., :notificationId, :userId)
const validateId = (paramName) => {
  return [
    param(paramName)
      .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage(`Invalid ${paramName} format`)
  ];
};

module.exports = {
  sendNotificationValidation,
  validateId,
};
