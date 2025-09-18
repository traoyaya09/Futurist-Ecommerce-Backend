const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/TransactionController');
const { authenticate } = require('../middleware/authentication');
const { validateTransactionCreation, validateTransactionUpdate } = require('../validators/transactionValidator');

// Create a new transaction with validation (User Only)
router.post('/create', authenticate, validateTransactionCreation, transactionController.createTransaction);

// Get all transactions for the authenticated user (User Only)
router.get('/', authenticate, transactionController.getTransactionsByUser);

// Get all transactions for the authenticated user (User Only)
router.get('/user', authenticate, transactionController.getTransactionsByUser);

// Get transaction by ID (User Only)
router.get('/:transactionId', authenticate, transactionController.getTransactionById);

// Update a transaction (User Only)
router.put('/:transactionId', authenticate, validateTransactionUpdate, transactionController.updateTransaction);

// Delete a transaction (User Only)
router.delete('/:transactionId', authenticate, transactionController.deleteTransaction);

module.exports = router;