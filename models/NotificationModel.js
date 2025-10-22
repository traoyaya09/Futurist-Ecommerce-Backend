const mongoose = require('mongoose');

// Define the notification schema
const notificationSchema = new mongoose.Schema({
    recipient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['Order', 'Promotion', 'General', 'Reminder', 'Alert'], // Added more notification types
        required: true 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
    metadata: {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },  // Reference to an order if related to an order notification
        promoCode: { type: String },  // If it's related to a promotion
    },
    channel: {
        type: String, 
        enum: ['email', 'sms', 'push', 'real-time'], // Notification channel type
        default: 'real-time'
    },
    readAt: { 
        type: Date  // Timestamp when the notification was marked as read
    },
    sentAt: { 
        type: Date, 
        default: Date.now 
    },
}, { timestamps: true });

// Indexes to optimize queries for unread notifications or sorting by date
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

// Static method to mark all notifications as read
notificationSchema.statics.markAllAsRead = function (userId) {
    return this.updateMany(
        { recipient: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
    );
};

// Instance method to mark a single notification as read
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

// Create the Notification model
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
