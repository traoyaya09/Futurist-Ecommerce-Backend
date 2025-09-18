const Notification = require('../models/NotificationModel');
const { sendEmail, sendSMS, sendPushNotification, sendRealTimeNotification } = require('../services/NotificationService');
const { validationResult } = require('express-validator');
const { getSocketInstance } = require('../socket');

const notificationController = {
  // Send notification via multiple channels
  sendNotification: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { userId, message } = req.body;

      // Send notifications via different channels
      await Promise.all([
        sendEmail(userId, message),
        sendSMS(userId, message),
        sendPushNotification(userId, message),
        sendRealTimeNotification(userId, message)
      ]);

      // Save notification to database
      const notification = new Notification({ userId, message });
      await notification.save();

      // Emit event after sending notification
      const io = getSocketInstance();
      io.emit('notification:sent', { userId, message, notificationId: notification._id });

      res.status(200).json({ success: true, message: 'Notification sent successfully' });
    } catch (error) {
      console.error('Error sending notification:', error.message);
      res.status(500).json({ success: false, message: 'Failed to send notification' });
    }
  },

  // Mark a notification as read
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;

      // Update the notification's 'read' status
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      // Emit event after marking notification as read
      const io = getSocketInstance();
      io.emit('notification:read', notificationId);

      res.status(200).json({ success: true, message: 'Notification marked as read', notification });
    } catch (error) {
      console.error('Error marking notification as read:', error.message);
      res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
  },

  // Get all notifications for a user with pagination
  getAllNotifications: async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const notifications = await Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const totalNotifications = await Notification.countDocuments({ recipient: userId });

      res.status(200).json({
        success: true,
        notifications,
        pagination: {
          total: totalNotifications,
          page: parseInt(page),
          limit: parseInt(limit),
        }
      });
    } catch (error) {
      console.error('Error fetching notifications:', error.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
    }
  }
};

module.exports = notificationController;
