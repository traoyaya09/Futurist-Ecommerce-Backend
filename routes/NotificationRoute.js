const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const notificationController = require('../controllers/NotificationController');
const { sendNotificationValidation, validateId } = require('../validators/notificationValidator');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Middleware for handling validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Route to send a notification (Admin Only)
router.post(
  '/send-notification',
  authenticate,
  authorize('Admin'),
  sendNotificationValidation,
  handleValidationErrors,
  notificationController.sendNotification
);

// Route to mark a notification as read (Authenticated User)
router.put(
  '/mark-as-read/:notificationId',
  authenticate,
  validateId('notificationId'),
  handleValidationErrors,
  notificationController.markAsRead
);

// Route to get all notifications for a specific user (Authenticated User)
router.get(
  '/notifications/:userId',
  authenticate,
  validateId('userId'),
  handleValidationErrors,
  notificationController.getAllNotifications
);

// Route to get all notifications (Admin Only)
router.get(
  '/',
  authenticate,
  authorize(["Admin", "Customer"]),
  handleValidationErrors,
  notificationController.getAllNotifications
);

module.exports = router;