const Chat = require('../models/Chat');  // Ensure the correct path for Chat model
const User = require('../models/User');  // Ensure the correct path for User model
const { encryptMessage } = require('../../utils/encryption'); // Ensure encryption utils exist and are correctly imported
const { io } = require('../../socket');  // Ensure socket instance is correctly initialized and imported

const chatHelper = {
  // Send a message between users with optional encryption
  sendMessage: async (senderId, recipientId, message, encrypted = false) => {
    try {
      // Check if sender and recipient exist
      const sender = await User.findById(senderId);
      const recipient = await User.findById(recipientId);
      
      if (!sender || !recipient) {
        throw new Error('Sender or recipient not found');
      }

      // Encrypt the message if encryption is not already applied
      const content = encrypted ? message : encryptMessage(message);

      // Save the message to the database
      const newMessage = new Chat({
        sender: senderId,
        recipient: recipientId,
        content,
      });

      await newMessage.save();

      // Broadcast the new message to both users in real-time
      io.to(senderId).emit('new_message', newMessage);
      io.to(recipientId).emit('new_message', newMessage);

      return newMessage;
    } catch (error) {
      console.error('Error sending message:', error.message);
      throw new Error('Error sending message');
    }
  },

  // Retrieve chat history between two users
  getChatHistory: async (userId, otherUserId) => {
    try {
      // Fetch chat history for both users, sort by timestamp
      const chatHistory = await Chat.find({
        $or: [
          { sender: userId, recipient: otherUserId },
          { sender: otherUserId, recipient: userId },
        ],
      })
        .sort({ createdAt: -1 })  // Sort messages by latest
        .populate('sender', 'name')  // Populate sender name
        .populate('recipient', 'name');  // Populate recipient name

      return chatHistory;
    } catch (error) {
      console.error('Error fetching chat history:', error.message);
      throw new Error('Error fetching chat history');
    }
  },

  // Create a new chat conversation (for group chats or user-to-user)
  createChat: async (chatData) => {
    try {
      const { participants, name } = chatData;

      // Ensure all participants exist
      const users = await User.find({ _id: { $in: participants } });
      if (users.length !== participants.length) {
        throw new Error('Some participants are invalid');
      }

      // Create and save the new chat
      const newChat = new Chat({
        participants,
        name,
      });

      await newChat.save();
      return newChat;
    } catch (error) {
      console.error('Error creating chat:', error.message);
      throw new Error('Error creating chat');
    }
  },

  // Mark a message as read
  markMessageAsRead: async (messageId) => {
    try {
      const message = await Chat.findByIdAndUpdate(
        messageId,
        { read: true },
        { new: true }
      );

      if (!message) {
        throw new Error('Message not found');
      }

      // Emit a real-time notification for message read status
      io.emit('message_read', { messageId });

      return message;
    } catch (error) {
      console.error('Error marking message as read:', error.message);
      throw new Error('Error marking message as read');
    }
  },

  // Delete a message
  deleteMessage: async (messageId) => {
    try {
      const deletedMessage = await Chat.findByIdAndDelete(messageId);

      if (!deletedMessage) {
        throw new Error('Message not found');
      }

      // Emit a real-time event for message deletion
      io.emit('message_deleted', { messageId });

      return deletedMessage;
    } catch (error) {
      console.error('Error deleting message:', error.message);
      throw new Error('Error deleting message');
    }
  },

  // Filter messages by keyword
  filterMessages: async (userId, keyword) => {
    try {
      const filteredMessages = await Chat.find({
        sender: userId,
        content: { $regex: keyword, $options: 'i' }, // Case-insensitive search
      });

      return filteredMessages;
    } catch (error) {
      console.error('Error filtering messages:', error.message);
      throw new Error('Error filtering messages');
    }
  },

  // Send a typing indicator
  sendTypingIndicator: (userId, isTyping) => {
    try {
      io.emit('typing_indicator', { userId, isTyping });
    } catch (error) {
      console.error('Error sending typing indicator:', error.message);
    }
  },

  // Send a file in a chat
  sendFile: async (senderId, recipientId, file) => {
    try {
      const sender = await User.findById(senderId);
      const recipient = await User.findById(recipientId);

      if (!sender || !recipient) {
        throw new Error('Sender or recipient not found');
      }

      // Save the file message
      const fileMessage = new Chat({
        sender: senderId,
        recipient: recipientId,
        content: file, // Store file as content (consider separating file storage)
      });

      await fileMessage.save();

      // Emit the file message
      io.to(senderId).emit('file_sent', fileMessage);
      io.to(recipientId).emit('file_sent', fileMessage);

      return fileMessage;
    } catch (error) {
      console.error('Error sending file:', error.message);
      throw new Error('Error sending file');
    }
  },
};

module.exports = chatHelper;
