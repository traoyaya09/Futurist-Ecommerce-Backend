const express = require('express');
const router = express.Router();
const chatController = require('../controllers/ChatController'); // Correct path to the controller

// Route to delete a message for a user (soft delete)
router.put('/softDelete/:messageId', chatController.softDeleteForUser);  // Ensure method exists

// Route to apply message status (e.g., delivered, read, failed)
router.put('/applyMessageStatus/:messageId', chatController.applyMessageStatus); // Make sure this method exists

// Route to send a message
router.post('/sendMessage', chatController.sendMessage);

// Route to get all chats (with pagination)
router.get('/getAllChats', chatController.getAllChats);  // Updated route

// Route to get chat history between two users (with pagination)
router.get('/getMessages/:userId1/:userId2', chatController.getMessagesBetweenUsers);

// Route to mark a message as read
router.put('/markAsRead/:messageId', chatController.markMessageAsRead);

// Route to update a message
router.put('/updateMessage/:messageId', chatController.updateMessage);

// Route to delete a message (hard delete)
router.delete('/deleteMessage/:messageId', chatController.deleteMessage);

// Route to send a typing indicator
router.post('/sendTypingIndicator', chatController.sendTypingIndicator);

// Route to send notifications
router.post('/sendNotification', chatController.sendNotification);

// Route to send a file (attachment) within a chat
router.post('/sendFile', chatController.sendFile);

// Route to filter messages by keyword
router.get('/filterMessages', chatController.filterMessages);

// Route to create a group chat
router.post('/createGroupChat', chatController.createGroupChat);

// Route to search messages by keyword
router.get('/searchMessages', chatController.searchMessages);
// Add this to handle the root of chat routes if needed
router.get('/', chatController.getAllChats);
  
module.exports = router;
