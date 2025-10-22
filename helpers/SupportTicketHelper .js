const Support = require('../models/SupportTicketModel');
const mongoose = require('mongoose');
const { sendSupportTicketConfirmationEmail } = require('../services/EmailService');

const supportHelper = {
    // Create a new support ticket
    

    createSupportTicket : async (req, res) => {
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
    
            // ✅ Send Support Ticket Confirmation Email
            await sendSupportTicketConfirmationEmail(user, newSupportTicket);
    
            res.status(201).json({ message: 'Support ticket created successfully', supportTicket: newSupportTicket });
        } catch (error) {
            console.error('Error creating support ticket:', error);
            res.status(500).json({ message: 'Error creating support ticket' });
        }
    },
    

    // Get support tickets for a user with pagination and sorting
    getSupportTicketsByUser: async (userId, page = 1, limit = 10, sort = 'createdAt') => {
        try {
            const isValidUserId = mongoose.Types.ObjectId.isValid(userId);
            if (!isValidUserId) {
                throw new Error('Invalid user ID format');
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sort]: -1 }, // Sort by field, defaulting to newest first
            };

            const tickets = await Support.find({ user: userId })
                .limit(options.limit)
                .skip((options.page - 1) * options.limit)
                .sort(options.sort)
                .populate('user', 'name email') // Optionally include user details
                .exec();

            const totalTickets = await Support.countDocuments({ user: userId });
            const totalPages = Math.ceil(totalTickets / options.limit);

            return {
                tickets,
                totalTickets,
                currentPage: options.page,
                totalPages,
            };
        } catch (error) {
            console.error('Error fetching support tickets:', error);
            throw new Error('Error fetching support tickets');
        }
    },

    // Admin: Get all support tickets with filtering, pagination, and sorting
    getAllSupportTickets: async (page = 1, limit = 10, status = null, sort = 'createdAt') => {
        try {
            const filter = status ? { status } : {};
            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sort]: -1 }, // Sort by field, defaulting to newest first
            };

            const tickets = await Support.find(filter)
                .limit(options.limit)
                .skip((options.page - 1) * options.limit)
                .populate('user', 'name email')
                .sort(options.sort)
                .exec();

            const totalTickets = await Support.countDocuments(filter);
            const totalPages = Math.ceil(totalTickets / options.limit);

            return {
                tickets,
                totalTickets,
                currentPage: options.page,
                totalPages,
            };
        } catch (error) {
            console.error('Error fetching support tickets:', error);
            throw new Error('Error fetching support tickets');
        }
    },

    // Delete a support ticket by ID
    deleteSupportTicketById: async (ticketId) => {
        try {
            const isValidTicketId = mongoose.Types.ObjectId.isValid(ticketId);
            if (!isValidTicketId) {
                throw new Error('Invalid ticket ID format');
            }

            const ticket = await Support.findByIdAndDelete(ticketId);
            if (!ticket) {
                throw new Error('Support ticket not found');
            }

            return ticket;
        } catch (error) {
            console.error('Error deleting support ticket:', error);
            throw new Error('Error deleting support ticket');
        }
    },
};

module.exports = supportHelper;
