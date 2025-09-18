const Chat = require('../models/ChatModel');
const User = require('../models/UserModel');
const { encryptMessage, decryptMessage } = require('../utils/encryption');
// Instead of destructuring io, we import getSocketInstance:
const { getSocketInstance } = require('../socket');

const chatController = {
  // Send a new message
  sendMessage: async (req, res) => {
    try {
      const { userId, message, encrypted, attachments = [] } = req.body;

      // Validate user existence
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Encrypt message if not already encrypted
      const encryptedMessage = encrypted ? message : encryptMessage(message);

      // Save message to the database
      const chat = new Chat({ 
        userId, 
        message: encryptedMessage, 
        attachments,
        read: false 
      });
      await chat.save();

      // Emit the new message event via WebSocket
      const io = getSocketInstance();
      io.emit('new_message', chat);

      res.status(201).json({ success: true, chat });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  },

  // Get all chats (with pagination)
  getAllChats: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query; // Pagination parameters

      // Find all chats with pagination, sorted by creation date
      const chats = await Chat.find()  // You can add filters or conditions if needed
        .sort({ createdAt: -1 })  // Sort by creation date (most recent first)
        .limit(limit * 1)  // Limit results to 'limit' number of chats per page
        .skip((page - 1) * limit);  // Skip previous pages' chats

      // Get the total number of chats for pagination info
      const totalChats = await Chat.countDocuments();

      res.status(200).json({
        success: true,
        chats,
        pagination: {
          page,
          limit,
          totalChats,
          totalPages: Math.ceil(totalChats / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching chats:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch chats' });
    }
  },

  // Get messages between two users (with pagination)
  getMessagesBetweenUsers: async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Find messages between two users
      const messages = await Chat.find({
        $or: [
          { userId: userId1 },
          { userId: userId2 }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

      res.status(200).json({ success: true, messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, message: 'Error fetching messages' });
    }
  },

  // Mark a message as read
  markMessageAsRead: async (req, res) => {
    try {
      const { messageId } = req.params;

      // Find and update message read status
      const message = await Chat.findByIdAndUpdate(
        messageId,
        { read: true },
        { new: true }
      );

      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Optionally, emit an event indicating the message was read
      const io = getSocketInstance();
      io.emit('chat:messageRead', messageId);

      res.status(200).json({ success: true, message: 'Message marked as read', message });
    } catch (error) {
      console.error('Error marking message as read:', error);
      res.status(500).json({ success: false, message: 'Error marking message as read' });
    }
  },

  // Apply message status (delivered, read, failed, etc.)
  applyMessageStatus: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { status } = req.body; // Assuming you pass the status in the request body

      // Validate status input (optional)
      const validStatuses = ['delivered', 'read', 'failed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      // Update the message status
      const updatedMessage = await Chat.findByIdAndUpdate(
        messageId,
        { $set: { status: status } },
        { new: true }
      );

      if (!updatedMessage) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Optionally, emit an event indicating the status update
      const io = getSocketInstance();
      io.emit('chat:messageStatusUpdated', { messageId, status });

      res.status(200).json({ success: true, message: 'Message status updated', data: updatedMessage });
    } catch (error) {
      console.error('Error updating message status:', error);
      res.status(500).json({ success: false, message: 'Failed to update message status' });
    }
  },

  // Update an existing message
  updateMessage: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { message, encrypted } = req.body;

      // Optionally encrypt the updated message
      const updatedMessage = encrypted ? message : encryptMessage(message);

      // Update message content in the database
      const updatedChat = await Chat.findByIdAndUpdate(
        messageId,
        { message: updatedMessage },
        { new: true }
      );

      if (!updatedChat) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Optionally, emit an event for message update
      const io = getSocketInstance();
      io.emit('chat:messageUpdated', updatedChat);

      res.status(200).json({ success: true, message: 'Message updated', data: updatedChat });
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json({ success: false, message: 'Failed to update message' });
    }
  },

  // Delete a message
  deleteMessage: async (req, res) => {
    try {
      const { messageId } = req.params;

      // Remove the message from the database
      const message = await Chat.findByIdAndDelete(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Optionally, emit an event for message deletion
      const io = getSocketInstance();
      io.emit('chat:messageDeleted', messageId);

      res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ success: false, message: 'Failed to delete message' });
    }
  },

  // Soft delete a message for a user (not complete deletion)
  softDeleteForUser: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { userId } = req.body; // Assuming you pass the userId in the request body

      // Find the message by ID and update it for soft delete
      const message = await Chat.findOneAndUpdate(
        { _id: messageId, userId: userId },
        { $set: { isDeleted: true } },
        { new: true }
      );

      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found or already deleted' });
      }

      // Optionally, emit event for soft deletion
      const io = getSocketInstance();
      io.emit('chat:messageSoftDeleted', { messageId, userId });

      res.status(200).json({ success: true, message: 'Message soft deleted', data: message });
    } catch (error) {
      console.error('Error soft deleting message:', error);
      res.status(500).json({ success: false, message: 'Failed to soft delete message' });
    }
  },

  // Send typing indicator
  sendTypingIndicator: async (req, res) => {
    try {
      const { userId, isTyping } = req.body;

      // Emit typing event via WebSocket using the shared socket instance
      const io = getSocketInstance();
      io.emit('chat:typingIndicator', { userId, isTyping });

      res.status(200).json({ success: true, message: 'Typing indicator sent' });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      res.status(500).json({ success: false, message: 'Failed to send typing indicator' });
    }
  },

  // Send a notification to a user
  sendNotification: async (req, res) => {
    try {
      const { userId, notification } = req.body;

      // Emit notification event via WebSocket
      const io = getSocketInstance();
      io.emit('chat:notification', { userId, notification });

      res.status(200).json({ success: true, message: 'Notification sent' });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ success: false, message: 'Failed to send notification' });
    }
  },

  // Handle file uploads in chat
  sendFile: async (req, res) => {
    try {
      const { userId, file } = req.body;
      // Placeholder logic for file handling
      const io = getSocketInstance();
      io.emit('chat:fileSent', { userId, file });
      res.status(200).json({ success: true, message: 'File sent' });
    } catch (error) {
      console.error('Error sending file:', error);
      res.status(500).json({ success: false, message: 'Failed to send file' });
    }
  },

  // Filter messages by keyword
  filterMessages: async (req, res) => {
    try {
      const { keyword } = req.query;
      const filteredMessages = await Chat.find({ message: { $regex: keyword, $options: 'i' } });

      res.status(200).json({ success: true, filteredMessages });
    } catch (error) {
      console.error('Error filtering messages:', error);
      res.status(500).json({ success: false, message: 'Failed to filter messages' });
    }
  },

  // Create a group chat
  createGroupChat: async (req, res) => {
    try {
      const { userIds, name } = req.body;

      // Implement group chat creation logic here
      // Optionally, emit event for group chat creation
      const io = getSocketInstance();
      io.emit('chat:groupChatCreated', { userIds, name });

      res.status(200).json({ success: true, message: 'Group chat created' });
    } catch (error) {
      console.error('Error creating group chat:', error);
      res.status(500).json({ success: false, message: 'Failed to create group chat' });
    }
  },

  // Search messages by keyword
  searchMessages: async (req, res) => {
    try {
      const { keyword } = req.query;
      const messages = await Chat.find({ message: { $regex: keyword, $options: 'i' } });

      res.status(200).json({ success: true, messages });
    } catch (error) {
      console.error('Error searching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to search messages' });
    }
  }
};

module.exports = chatController;
