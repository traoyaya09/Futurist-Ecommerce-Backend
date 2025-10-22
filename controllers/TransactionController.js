const axios = require('axios');
const { validationResult } = require('express-validator');
const Transaction = require('../models/LedgerTransaction');
const LedgerTransaction = require('../models/Transaction');
const { getSocketInstance } = require('../socket');

const FRAUD_API_URL = process.env.FRAUD_API_URL || "http://localhost:8000/fraud/predict";
const FRAUD_API_KEY = process.env.FRAUD_API_KEY || "internal_secret"; // optional internal auth header

const transactionController = {

  // CREATE a new transaction with optional fraud prediction
  createTransaction: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { amount, description, type, currency, paymentMethod, isRefundable, meta, iso_contamination } = req.body;
      const validTypes = ['debit', 'credit'];
      if (!validTypes.includes(type)) return res.status(400).json({ success: false, message: 'Invalid transaction type' });
      if (amount <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });

      // 1️⃣ Create transaction
      const newTransaction = new Transaction({
        user: req.user.id,
        amount,
        description,
        type,
        currency: currency || 'USD',
        paymentMethod,
        isRefundable: isRefundable || false,
        meta: meta || {}
      });
      await newTransaction.save();

      // 2️⃣ Create ledger entries
      const ledgerEntries = [
        new LedgerTransaction({
          transaction: newTransaction._id,
          account: `user:${req.user.id}`,
          entryType: type === 'debit' ? 'Debit' : 'Credit',
          amount,
          balanceBefore: 0,
          balanceAfter: amount,
          currency: newTransaction.currency
        }),
        new LedgerTransaction({
          transaction: newTransaction._id,
          account: `platform:fees`,
          entryType: type === 'debit' ? 'Credit' : 'Debit',
          amount: newTransaction.meta.fees || 0,
          balanceBefore: 0,
          balanceAfter: newTransaction.meta.fees || 0,
          currency: newTransaction.currency
        })
      ];
      await LedgerTransaction.insertMany(ledgerEntries);

      // 3️⃣ Fetch fraud prediction
      let fraudPrediction = {};
      try {
        const payload = { _id: newTransaction._id };
        if (iso_contamination !== undefined) payload.iso_contamination = iso_contamination;

        const response = await axios.post(FRAUD_API_URL,
          payload,
          { headers: { Authorization: `Bearer ${FRAUD_API_KEY}` } }
        );
        fraudPrediction = response.data;
      } catch (err) {
        console.error('Fraud API error:', err.message);
        fraudPrediction = { warning: 'Fraud prediction failed' };
      }

      // 4️⃣ Emit socket event
      getSocketInstance().emit('transaction:created', { transaction: newTransaction, ledgerEntries, fraudPrediction });

      // 5️⃣ Return enriched response
      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: { transaction: { ...newTransaction.toObject(), fraudPrediction }, ledgerEntries }
      });

    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // GET all transactions with optional batch fraud predictions
  getTransactionsByUser: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const sortBy = req.query.sortBy || 'createdAt';
      const order = req.query.order === 'asc' ? 1 : -1;
      const type = req.query.type;
      const includeFraud = req.query.includeFraud === 'true';
      const iso_contamination = req.query.iso_contamination ? parseFloat(req.query.iso_contamination) : undefined;

      const filter = { user: req.user.id };
      if (type) filter.type = type;

      const transactions = await Transaction.find(filter)
        .sort({ [sortBy]: order })
        .skip((page - 1) * limit)
        .limit(limit);

      const transactionIds = transactions.map(txn => txn._id);

      // 1️⃣ Fetch ledger entries in batch
      const allLedgerEntries = await LedgerTransaction.find({ transaction: { $in: transactionIds } });
      const ledgerMap = {};
      allLedgerEntries.forEach(entry => {
        if (!ledgerMap[entry.transaction]) ledgerMap[entry.transaction] = [];
        ledgerMap[entry.transaction].push(entry);
      });

      // 2️⃣ Fetch fraud predictions in batch if requested
      let fraudMap = {};
      if (includeFraud && transactionIds.length) {
        try {
          const payload = { _ids: transactionIds };
          if (iso_contamination !== undefined) payload.iso_contamination = iso_contamination;

          const response = await axios.post(FRAUD_API_URL, payload,
            { headers: { Authorization: `Bearer ${FRAUD_API_KEY}` } }
          );
          fraudMap = response.data || {};
        } catch (err) {
          console.error('Fraud API batch error:', err.message);
          transactionIds.forEach(id => fraudMap[id] = { warning: 'Fraud prediction failed' });
        }
      }

      // 3️⃣ Assemble final transaction objects
      const transactionsWithLedger = transactions.map(txn => {
        const txnObj = { ...txn.toObject(), ledgerEntries: ledgerMap[txn._id] || [] };
        if (includeFraud) txnObj.fraudPrediction = fraudMap[txn._id] || { warning: 'Fraud prediction failed' };
        return txnObj;
      });

      const totalItems = await Transaction.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: transactionsWithLedger,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalItems / limit),
          totalItems,
          limit,
        }
      });

    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // GET a single transaction by ID with optional fraud prediction
  getTransactionById: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const includeFraud = req.query.includeFraud === 'true';
      const iso_contamination = req.query.iso_contamination ? parseFloat(req.query.iso_contamination) : undefined;

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (transaction.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      const ledgerEntries = await LedgerTransaction.find({ transaction: transaction._id });
      const txnObj = { ...transaction.toObject(), ledgerEntries };

      if (includeFraud) {
        try {
          const payload = { _id: transaction._id };
          if (iso_contamination !== undefined) payload.iso_contamination = iso_contamination;

          const response = await axios.post(FRAUD_API_URL,
            payload,
            { headers: { Authorization: `Bearer ${FRAUD_API_KEY}` } }
          );
          txnObj.fraudPrediction = response.data;
        } catch (err) {
          console.error(`Fraud API error for transaction ${transaction._id}:`, err.message);
          txnObj.fraudPrediction = { warning: 'Fraud prediction failed' };
        }
      }

      res.status(200).json({ success: true, data: txnObj });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // UPDATE a transaction and refresh fraud prediction
  updateTransaction: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const { amount, description, type, currency, paymentMethod, isRefundable, meta, iso_contamination } = req.body;

      const validTypes = ['debit', 'credit'];
      if (type && !validTypes.includes(type)) return res.status(400).json({ success: false, message: 'Invalid transaction type' });

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (transaction.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      // 1️⃣ Update transaction fields
      transaction.amount = amount ?? transaction.amount;
      transaction.description = description ?? transaction.description;
      transaction.type = type ?? transaction.type;
      transaction.currency = currency ?? transaction.currency;
      transaction.paymentMethod = paymentMethod ?? transaction.paymentMethod;
      transaction.isRefundable = isRefundable ?? transaction.isRefundable;
      transaction.meta = meta ?? transaction.meta;

      const updatedTransaction = await transaction.save();

      // 2️⃣ Update ledger entries if amount or type changed
      if (amount || type) {
        const ledgerEntries = await LedgerTransaction.find({ transaction: transactionId });
        for (const entry of ledgerEntries) {
          if (amount) entry.amount = amount;
          if (type) entry.entryType = type === 'debit' ? 'Debit' : 'Credit';
          await entry.save();
        }
      }

      // 3️⃣ Fetch refreshed fraud prediction
      let fraudPrediction = {};
      try {
        const payload = { _id: updatedTransaction._id };
        if (iso_contamination !== undefined) payload.iso_contamination = iso_contamination;

        const response = await axios.post(FRAUD_API_URL,
          payload,
          { headers: { Authorization: `Bearer ${FRAUD_API_KEY}` } }
        );
        fraudPrediction = response.data;
      } catch (err) {
        console.error('Fraud API error during update:', err.message);
        fraudPrediction = { warning: 'Fraud prediction failed' };
      }

      // 4️⃣ Emit socket event
      getSocketInstance().emit('transaction:updated', { transaction: updatedTransaction, fraudPrediction });

      // 5️⃣ Return enriched response
      res.status(200).json({
        success: true,
        message: 'Transaction updated successfully',
        data: { ...updatedTransaction.toObject(), fraudPrediction }
      });

    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  },

  // DELETE a transaction and its ledger entries
  deleteTransaction: async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (transaction.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      await LedgerTransaction.deleteMany({ transaction: transactionId });
      await Transaction.findByIdAndDelete(transactionId);

      getSocketInstance().emit('transaction:deleted', transactionId);

      res.status(200).json({ success: true, message: 'Transaction and ledger entries deleted successfully' });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

};

module.exports = transactionController;
