const { validationResult } = require('express-validator');
const Transaction = require('../models/TransactionModel');
const { getSocketInstance } = require('../socket');

const transactionController = {
  // Create a new transaction
  createTransaction: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { amount, description, type } = req.body;
      const validTypes = ['debit', 'credit'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid transaction type. Must be "debit" or "credit".' });
      }
      if (amount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
      }

      const newTransaction = new Transaction({
        user: req.user.id,
        amount,
        description,
        type,
      });
      await newTransaction.save();

      getSocketInstance().emit('transaction:created', newTransaction);

      res.status(201).json({ success: true, message: 'Transaction created successfully', data: newTransaction });
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // GET all transactions for a user with pagination, filtering, and sorting
  getTransactionsByUser: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const sortBy = req.query.sortBy || 'createdAt';
      const order = req.query.order === 'asc' ? 1 : -1;
      const type = req.query.type;

      const filter = { user: req.user.id };
      if (type) filter.type = type;

      const transactions = await Transaction.find(filter)
        .sort({ [sortBy]: order })
        .skip((page - 1) * limit)
        .limit(limit);

      const totalItems = await Transaction.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalItems / limit),
          totalItems,
          limit,
        },
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // GET a specific transaction by ID
  getTransactionById: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (transaction.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      res.status(200).json({ success: true, data: transaction });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // DELETE a transaction
  deleteTransaction: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (transaction.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      await Transaction.findByIdAndDelete(transactionId);
      getSocketInstance().emit('transaction:deleted', transactionId);

      res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // UPDATE a transaction
  updateTransaction: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const { amount, description, type } = req.body;

      const validTypes = ['debit', 'credit'];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid transaction type. Must be "debit" or "credit".' });
      }

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (transaction.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      transaction.amount = amount ?? transaction.amount;
      transaction.description = description ?? transaction.description;
      transaction.type = type ?? transaction.type;

      const updatedTransaction = await transaction.save();
      getSocketInstance().emit('transaction:updated', updatedTransaction);

      res.status(200).json({ success: true, message: 'Transaction updated successfully', data: updatedTransaction });
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },
};

module.exports = transactionController;
