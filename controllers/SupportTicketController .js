const Support = require('../models/SupportTicketModel');
const User = require('../models/UserModel');
const { validationResult } = require('express-validator');
const { getSocketInstance } = require('../socket');

const supportController = {
  // Create a new support ticket
  createSupportTicket: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { subject, message } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const newSupportTicket = new Support({
        user: user.id,
        subject,
        message,
        status: 'Open'
      });

      await newSupportTicket.save();

      // Emit socket event for new support ticket creation
      const io = getSocketInstance();
      io.emit('support:ticketCreated', newSupportTicket);

      res.status(201).json({ message: 'Support ticket created successfully', supportTicket: newSupportTicket });
    } catch (error) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({ message: 'Error creating support ticket' });
    }
  },

  // Get support tickets for a user with pagination
  getSupportTickets: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const tickets = await Support.find({ user: user.id })
        .limit(parseInt(limit))
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Support.countDocuments({ user: user.id });

      res.status(200).json({
        tickets,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      res.status(500).json({ message: 'Error fetching support tickets' });
    }
  },

  // Admin: Get all support tickets with pagination and filtering
  getAllSupportTickets: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;

      const filter = {};
      if (status) {
        filter.status = status;
      }

      const tickets = await Support.find(filter)
        .limit(parseInt(limit))
        .skip((page - 1) * limit)
        .populate('user', 'name email')  // Include user information
        .sort({ createdAt: -1 });

      const total = await Support.countDocuments(filter);

      res.status(200).json({
        tickets,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error fetching all support tickets:', error);
      res.status(500).json({ message: 'Error fetching all support tickets' });
    }
  },

  // Admin: Update support ticket status
  updateSupportTicketStatus: async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;

      const validStatuses = ['Open', 'In Progress', 'Closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const ticket = await Support.findByIdAndUpdate(ticketId, { status }, { new: true });
      if (!ticket) {
        return res.status(404).json({ message: 'Support ticket not found' });
      }

      // Emit socket event for ticket update
      const io = getSocketInstance();
      io.emit('support:ticketUpdated', ticket);

      res.status(200).json({ message: 'Support ticket status updated', ticket });
    } catch (error) {
      console.error('Error updating support ticket status:', error);
      res.status(500).json({ message: 'Error updating support ticket status' });
    }
  },

  // Admin: Delete support ticket
  deleteSupportTicket: async (req, res) => {
    try {
      const { ticketId } = req.params;

      const ticket = await Support.findByIdAndDelete(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: 'Support ticket not found' });
      }

      // Emit socket event for ticket deletion
      const io = getSocketInstance();
      io.emit('support:ticketDeleted', ticketId);

      res.status(200).json({ message: 'Support ticket deleted successfully' });
    } catch (error) {
      console.error('Error deleting support ticket:', error);
      res.status(500).json({ message: 'Error deleting support ticket' });
    }
  },
};

module.exports = supportController;
