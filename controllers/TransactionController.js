const { validationResult } = require('express-validator');
const Transaction = require('../models/TransactionModel');
const User = require('../models/UserModel');
const { getSocketInstance } = require('../socket');

const transactionController = {
  // Create a new transaction
  createTransaction: async (req, res) => {
    try {
      // Validate input fields
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, description, type } = req.body;

      // Validate the transaction type (debit or credit)
      const validTypes = ['debit', 'credit'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid transaction type. It must be either "debit" or "credit".' });
      }

      // Ensure the amount is positive
      if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be greater than zero' });
      }

      const newTransaction = new Transaction({
        user: req.user.id,
        amount,
        description,
        type: type || 'debit', // Default to debit if not provided
      });

      await newTransaction.save();

      // Emit socket event for new transaction creation
      const io = getSocketInstance();
      io.emit('transaction:created', newTransaction);

      res.status(201).json({ message: 'Transaction created successfully', transaction: newTransaction });
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  // Get all transactions for a user, with pagination and sorting
  getTransactionsByUser: async (req, res) => {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', type } = req.query;

      const sortOptions = {};
      sortOptions[sortBy] = order === 'desc' ? -1 : 1;

      const filter = { user: req.user.id };
      if (type) {
        filter.type = type; // Filter by transaction type (debit/credit)
      }

      const transactions = await Transaction.find(filter)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * limit);

      const total = await Transaction.countDocuments(filter);

      res.status(200).json({
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        transactions,
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  // Get a specific transaction by ID
  getTransactionById: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // Ensure the user has access to the transaction
      if (transaction.user.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.status(200).json(transaction);
    } catch (error) {
      console.error('Error fetching transaction:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  // Delete a transaction
  deleteTransaction: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // Ensure the user has access to delete the transaction
      if (transaction.user.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await Transaction.findByIdAndDelete(transactionId);

      // Emit socket event for transaction deletion
      const io = getSocketInstance();
      io.emit('transaction:deleted', transactionId);

      res.status(200).json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  // Update an existing transaction
  updateTransaction: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const { amount, description, type } = req.body;

      // Validate the transaction type (debit or credit)
      const validTypes = ['debit', 'credit'];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid transaction type. It must be either "debit" or "credit".' });
      }

      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // Ensure the user has access to update the transaction
      if (transaction.user.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Update the transaction fields if provided
      transaction.amount = amount || transaction.amount;
      transaction.description = description || transaction.description;
      transaction.type = type || transaction.type;

      const updatedTransaction = await transaction.save();

      // Emit socket event for transaction update
      const io = getSocketInstance();
      io.emit('transaction:updated', updatedTransaction);

      res.status(200).json({
        message: 'Transaction updated successfully',
        transaction: updatedTransaction,
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
};

module.exports = transactionController;
