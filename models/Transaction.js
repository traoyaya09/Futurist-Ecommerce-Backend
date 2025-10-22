// Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },

  account: { type: String, required: true }, // e.g. "customer:12345", "merchant:67890", "platform:fees"
  entryType: { type: String, enum: ['Debit', 'Credit'], required: true }, // double-entry

  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },

  balanceBefore: { type: Number, default: 0 },
  balanceAfter: { type: Number, default: 0 },

  meta: { type: mongoose.Schema.Types.Mixed } // any extra audit data
}, { timestamps: true });

// For fast queries: ensure no mismatch between Debit/Credit
TransactionSchema.index({ transaction: 1, account: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
