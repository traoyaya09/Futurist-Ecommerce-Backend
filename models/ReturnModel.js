const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const returnSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  order: { 
    type: Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  product: { 
    type: Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  reason: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 10, // Ensure minimum length for detailed reason
  },
  status: { 
    type: String, 
    enum: ['Requested', 'Approved', 'Rejected', 'Processed'], 
    default: 'Requested' 
  },
  additionalComments: { 
    type: String, 
    trim: true, 
    maxlength: 500 // Optional field for adding further details during return
  },
  refundAmount: { 
    type: Number, 
    default: 0, // Track the amount refunded for the product
    min: 0 
  },
  processedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User'  // Reference to the admin or user who processed the return
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: null 
  },
  processedAt: { 
    type: Date, 
    default: null 
  },
  refundIssuedAt: { 
    type: Date, 
    default: null // When the refund was issued (if applicable)
  },
  returnMethod: { 
    type: String, 
    enum: ['Courier Pickup', 'Dropoff'], 
    default: 'Courier Pickup' 
  },
  returnTrackingNumber: { 
    type: String, 
    trim: true 
  }, // Optional field for tracking return shipping
}, { 
  timestamps: true 
  // Automatically adds `createdAt` and `updatedAt`
});

// Middleware to update timestamps for certain operations
returnSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const Return = mongoose.model('Return', returnSchema);

module.exports = Return;
