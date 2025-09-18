const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
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
  }, // To define whether the transaction is a Debit or Credit
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
  }, // Optional reference or transaction ID from an external payment gateway
  currency: { 
    type: String, 
    default: 'USD' 
  }, // Currency for the transaction
  isRefundable: { 
    type: Boolean, 
    default: false 
  }, // Whether the transaction is eligible for a refund
  meta: {
    // For storing additional details such as transaction fees, tax, or extra data
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
transactionSchema.index({ user: 1, status: 1 });
//transactionSchema.index({ referenceId: 1 });

// Virtuals for calculating final amount after fees and taxes
transactionSchema.virtual('finalAmount').get(function() {
  return this.amount - this.meta.fees - this.meta.tax;
});

// Pre-save hook to ensure that amount is positive
transactionSchema.pre('save', function(next) {
  if (this.amount < 0) {
    return next(new Error('Amount cannot be negative'));
  }
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
