const mongoose = require('mongoose');

const LedgerTransactionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: [0, 'Amount cannot be negative'] 
  },
  type: { 
    type: String, 
    enum: ['Debit', 'Credit'], 
    required: true 
  }, // To define whether the LedgerTransaction is a Debit or Credit
  status: { 
    type: String, 
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'], 
    default: 'Pending' 
  },
  description: { 
    type: String, 
    required: true, 
    maxlength: 500 
  }, // Max length for the description
  paymentMethod: { 
    type: String, 
    enum: ['Credit Card', 'PayPal', 'Bank Transfer', 'Cash'], 
    required: true 
  }, // To track the payment method used
  referenceId: { 
    type: String, 
    unique: true, 
    sparse: true 
  }, // Optional reference or LedgerTransaction ID from an external payment gateway
  currency: { 
    type: String, 
    default: 'USD' 
  }, // Currency for the LedgerTransaction
  isRefundable: { 
    type: Boolean, 
    default: false 
  }, // Whether the LedgerTransaction is eligible for a refund
  meta: {
    // For storing additional details such as LedgerTransaction fees, tax, or extra data
    fees: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    extraData: { type: mongoose.Schema.Types.Mixed }
  }
}, 
{ 
  timestamps: true, 
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true } 
});

// Indexing for better performance
LedgerTransactionSchema.index({ user: 1, status: 1 });
//LedgerTransactionSchema.index({ referenceId: 1 });

// Virtuals for calculating final amount after fees and taxes
LedgerTransactionSchema.virtual('finalAmount').get(function() {
  return this.amount - this.meta.fees - this.meta.tax;
});

// Pre-save hook to ensure that amount is positive
LedgerTransactionSchema.pre('save', function(next) {
  if (this.amount < 0) {
    return next(new Error('Amount cannot be negative'));
  }
  next();
});

const LedgerTransaction = mongoose.model('LedgerTransaction', LedgerTransactionSchema);

module.exports = LedgerTransaction;
