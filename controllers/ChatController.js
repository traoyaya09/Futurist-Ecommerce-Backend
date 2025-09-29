const Chat = require('../models/ChatModel');
const User = require('../models/UserModel');
const { encryptMessage, decryptMessage } = require('../utils/encryption');
const { getSocketInstance } = require('../socket');

const chatController = {
  // Send a new message
  sendMessage: async (req, res) => {
    try {
      const { userId, message, encrypted, attachments = [] } = req.body;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const encryptedMessage = encrypted ? message : encryptMessage(message);

      const chat = new Chat({ userId, message: encryptedMessage, attachments, read: false });
      await chat.save();

      getSocketInstance().emit('new_message', chat);

      res.status(201).json({ success: true, data: chat });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  },

  // Get all chats with pagination
  getAllChats: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const chats = await Chat.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const totalChats = await Chat.countDocuments();

      res.status(200).json({
        success: true,
        data: chats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalChats / limit),
          totalItems: totalChats,
          limit,
        },
      });
    } catch (error) {
      console.error('Error fetching chats:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch chats' });
    }
  },

  // Get messages between two users with pagination
  getMessagesBetweenUsers: async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const messages = await Chat.find({
        $or: [
          { userId: userId1 },
          { userId: userId2 }
        ]
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const totalMessages = await Chat.countDocuments({
        $or: [
          { userId: userId1 },
          { userId: userId2 }
        ]
      });

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMessages / limit),
          totalItems: totalMessages,
          limit,
        },
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  },

  // Mark a message as read
  markMessageAsRead: async (req, res) => {
    try {
      const { messageId } = req.params;
      const message = await Chat.findByIdAndUpdate(messageId, { read: true }, { new: true });
      if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

      getSocketInstance().emit('chat:messageRead', messageId);
      res.status(200).json({ success: true, message: 'Message marked as read', data: message });
    } catch (error) {
      console.error('Error marking message as read:', error);
      res.status(500).json({ success: false, message: 'Error marking message as read' });
    }
  },

  // Apply message status (delivered, read, failed)
  applyMessageStatus: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { status } = req.body;
      const validStatuses = ['delivered', 'read', 'failed'];
      if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

      const updatedMessage = await Chat.findByIdAndUpdate(messageId, { status }, { new: true });
      if (!updatedMessage) return res.status(404).json({ success: false, message: 'Message not found' });

      getSocketInstance().emit('chat:messageStatusUpdated', { messageId, status });
      res.status(200).json({ success: true, message: 'Message status updated', data: updatedMessage });
    } catch (error) {
      console.error('Error updating message status:', error);
      res.status(500).json({ success: false, message: 'Failed to update message status' });
    }
  },

  // Update a message
  updateMessage: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { message, encrypted } = req.body;
      const updatedMessage = encrypted ? message : encryptMessage(message);

      const chat = await Chat.findByIdAndUpdate(messageId, { message: updatedMessage }, { new: true });
      if (!chat) return res.status(404).json({ success: false, message: 'Message not found' });

      getSocketInstance().emit('chat:messageUpdated', chat);
      res.status(200).json({ success: true, message: 'Message updated', data: chat });
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json({ success: false, message: 'Failed to update message' });
    }
  },

  // Delete a message
  deleteMessage: async (req, res) => {
    try {
      const { messageId } = req.params;
      const message = await Chat.findByIdAndDelete(messageId);
      if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

      getSocketInstance().emit('chat:messageDeleted', messageId);
      res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ success: false, message: 'Failed to delete message' });
    }
  },

  // Soft delete for a user
  softDeleteForUser: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { userId } = req.body;

      const message = await Chat.findOneAndUpdate(
        { _id: messageId, userId },
        { isDeleted: true },
        { new: true }
      );
      if (!message) return res.status(404).json({ success: false, message: 'Message not found or already deleted' });

      getSocketInstance().emit('chat:messageSoftDeleted', { messageId, userId });
      res.status(200).json({ success: true, message: 'Message soft deleted', data: message });
    } catch (error) {
      console.error('Error soft deleting message:', error);
      res.status(500).json({ success: false, message: 'Failed to soft delete message' });
    }
  },

  // GET filtered messages with pagination
  filterMessages: async (req, res) => {
    try {
      const { keyword } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const messages = await Chat.find({ message: { $regex: keyword, $options: 'i' } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const totalMessages = await Chat.countDocuments({ message: { $regex: keyword, $options: 'i' } });

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMessages / limit),
          totalItems: totalMessages,
          limit,
        },
      });
    } catch (error) {
      console.error('Error filtering messages:', error);
      res.status(500).json({ success: false, message: 'Failed to filter messages' });
    }
  },

  // GET search messages with pagination
  searchMessages: async (req, res) => {
    try {
      const { keyword } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const messages = await Chat.find({ message: { $regex: keyword, $options: 'i' } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const totalMessages = await Chat.countDocuments({ message: { $regex: keyword, $options: 'i' } });

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMessages / limit),
          totalItems: totalMessages,
          limit,
        },
      });
    } catch (error) {
      console.error('Error searching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to search messages' });
    }
  },

  // Typing indicator, notifications, file sending, group chat creation remain unchanged
  sendTypingIndicator: async (req, res) => {
    try {
      const { userId, isTyping } = req.body;
      getSocketInstance().emit('chat:typingIndicator', { userId, isTyping });
      res.status(200).json({ success: true, message: 'Typing indicator sent' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Failed to send typing indicator' });
    }
  },

  sendNotification: async (req, res) => {
    try {
      const { userId, notification } = req.body;
      getSocketInstance().emit('chat:notification', { userId, notification });
      res.status(200).json({ success: true, message: 'Notification sent' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Failed to send notification' });
    }
  },

  sendFile: async (req, res) => {
    try {
      const { userId, file } = req.body;
      getSocketInstance().emit('chat:fileSent', { userId, file });
      res.status(200).json({ success: true, message: 'File sent' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Failed to send file' });
    }
  },

  createGroupChat: async (req, res) => {
    try {
      const { userIds, name } = req.body;
      getSocketInstance().emit('chat:groupChatCreated', { userIds, name });
      res.status(200).json({ success: true, message: 'Group chat created' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Failed to create group chat' });
    }
  },
};

module.exports = chatController;
