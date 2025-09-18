const mongoose = require('mongoose');

// Define the schema for attachments (files, images, etc.)
const attachmentSchema = new mongoose.Schema({
  fileType: { type: String, required: true },  // e.g., 'image', 'file', 'video'
  url: { type: String, required: true },  // The URL or path to the file
  fileName: { type: String },  // Optional: original filename
  size: { type: Number },  // Optional: file size in bytes
  uploadDate: { type: Date, default: Date.now }  // Timestamp for when the file was uploaded
});

// Define the message schema
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },  // The actual message content (encrypted if applicable)
  encrypted: { type: Boolean, default: false },  // Flag to indicate if the message is encrypted
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },  // Message status tracking
  attachments: [attachmentSchema],  // Array of attachments (files, images, etc.)
  read: { type: Boolean, default: false },  // Flag to mark if the message has been read
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  // Track users for whom the message is deleted
}, { timestamps: true });

// Add indexing for better performance in searching by user and message content
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ content: 'text' });  // For full-text search on message content

// Define a static method for paginated message retrieval
messageSchema.statics.getMessagesBetweenUsers = function (userId1, userId2, page = 1, limit = 20) {
  return this.find({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 }
    ]
  })
  .sort({ createdAt: -1 })  // Sort by latest messages
  .skip((page - 1) * limit)
  .limit(limit)
  .populate('sender', 'name')
  .populate('recipient', 'name')
  .exec();
};

// Instance method to mark a message as read
messageSchema.methods.markAsRead = function () {
  this.read = true;
  this.status = 'read';
  return this.save();
};

// Instance method to add attachment
messageSchema.methods.addAttachment = function (fileData) {
  this.attachments.push(fileData);
  return this.save();
};

// Instance method to delete a message for a specific user (soft delete)
messageSchema.methods.softDeleteForUser = function (userId) {
  this.deletedFor.push(userId);
  return this.save();
};

const Chat = mongoose.model('Chat', messageSchema);

module.exports = Chat;
