const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/TransactionController');
const { authenticate } = require('../middleware/authentication');
const { validateTransactionCreation, validateTransactionUpdate } = require('../validators/transactionValidator');

// 1️⃣ Create a new transaction (User only)
router.post(
  '/',
  authenticate,validateTransactionCreation,transactionController.createTransaction
);

// 2️⃣ Get all transactions for the authenticated user (User only)
router.get(
  '/', authenticate,  transactionController.getTransactionsByUser
);

// 3️⃣ Get a specific transaction by ID (User only)
router.get(
  '/:transactionId',  authenticate,  transactionController.getTransactionById
);

// 4️⃣ Update a transaction by ID (User only)
router.put(
  '/:transactionId',authenticate, validateTransactionUpdate,transactionController.updateTransaction
);

// 5️⃣ Delete a transaction by ID (User only)
router.delete(
  '/:transactionId',authenticate,transactionController.deleteTransaction
);

module.exports = router;
