const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');
const { createSupportTicketValidation, updateSupportTicketValidation } = require('../validators/supportValidator');
const supportController = require('../controllers/SupportTicketController ');

// Create a new support ticket (User Only)
router.post('/support', authenticate, createSupportTicketValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject, message } = req.body;
    const user = req.user;
    const newSupportTicket = await supportController.createSupportTicket(user, subject, message);

    res.status(201).json({ message: 'Support ticket created successfully', supportTicket: newSupportTicket });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ message: 'Error creating support ticket' });
  }
});

// Get all support tickets for the authenticated user
router.get('/support', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const supportTickets = await supportController.getSupportTicketsByUser(user._id);

    res.status(200).json(supportTickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ message: 'Error fetching support tickets' });
  }
});

// Get all support tickets for the authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const supportTickets = await supportController.getSupportTicketsByUser(user._id);

    res.status(200).json(supportTickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ message: 'Error fetching support tickets' });
  }
});

// Update support ticket by ID (User Only)
router.put('/support/:ticketId', authenticate, updateSupportTicketValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ticketId } = req.params;
    const { subject, message } = req.body;
    const updatedTicket = await supportController.updateSupportTicket(ticketId, subject, message, req.user._id);

    if (!updatedTicket) {
      return res.status(404).json({ message: 'Support ticket not found or unauthorized' });
    }

    res.status(200).json({ message: 'Support ticket updated successfully', supportTicket: updatedTicket });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    res.status(500).json({ message: 'Error updating support ticket' });
  }
});

// Close a support ticket by ID (Admin or ticket owner)
router.put('/support/:ticketId/close', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user._id;

    const closedTicket = await supportController.closeSupportTicket(ticketId, userId);

    if (!closedTicket) {
      return res.status(404).json({ message: 'Support ticket not found or unauthorized to close' });
    }

    res.status(200).json({ message: 'Support ticket closed successfully', supportTicket: closedTicket });
  } catch (error) {
    console.error('Error closing support ticket:', error);
    res.status(500).json({ message: 'Error closing support ticket' });
  }
});

// Admin-only route to fetch all support tickets (for management purposes)
router.get('/support/admin/all', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const supportTickets = await supportController.getAllSupportTickets();
    res.status(200).json(supportTickets);
  } catch (error) {
    console.error('Error fetching all support tickets:', error);
    res.status(500).json({ message: 'Error fetching all support tickets' });
  }
});

module.exports = router;