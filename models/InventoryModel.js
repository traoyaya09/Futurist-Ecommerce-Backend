const mongoose = require('mongoose');

// Schema to track stock history for auditing purposes
const stockHistorySchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ['increase', 'decrease', 'initial'],  // Action performed on stock
        required: true
    },
    quantity: { type: Number, required: true },  // Quantity of the stock change
    timestamp: { type: Date, default: Date.now },  // When the stock change happened
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }  // User who made the adjustment
}, { _id: false });

const inventorySchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Inventory name is required'],
        unique: true,
        trim: true 
    },
    sku: { 
        type: String, 
        required: [true, 'SKU is required'], 
        unique: true, 
        trim: true 
    },
    description: { 
        type: String, 
        trim: true, 
        maxlength: [500, 'Description can be up to 500 characters'] 
    },
    quantity: { 
        type: Number, 
        default: 0, 
        min: [0, 'Quantity cannot be negative'],
        required: true
    },
    lowStockThreshold: { 
        type: Number, 
        default: 5,  // Default low stock threshold
        min: [0, 'Low stock threshold cannot be negative']
    },
    stockStatus: {
        type: String,
        enum: ['in-stock', 'low-stock', 'out-of-stock'],
        default: 'in-stock'
    },
    location: {
        type: String,
        trim: true,
        default: 'Main Warehouse',  // Default location for the inventory
    },
    stockHistory: [stockHistorySchema],  // Array to track stock adjustments
    lastRestocked: { 
        type: Date 
    },
}, { timestamps: true });

// Pre-save middleware to automatically update stock status and history
inventorySchema.pre('save', function (next) {
    if (!this.isModified('quantity')) return next();  // Skip if quantity is not modified

    // Track the previous quantity value to determine the action
    const previousQuantity = this._doc.quantity;

    // Adjust the stock status based on quantity
    if (this.quantity <= 0) {
        this.stockStatus = 'out-of-stock';
    } else if (this.quantity <= this.lowStockThreshold) {
        this.stockStatus = 'low-stock';
    } else {
        this.stockStatus = 'in-stock';
    }

    // Only log the change if the quantity is actually being modified
    if (this.isModified('quantity')) {
        const action = this.quantity > previousQuantity ? 'increase' : (this.quantity < previousQuantity ? 'decrease' : 'initial');
        
        // Push a new entry into stock history
        this.stockHistory.push({
            action,
            quantity: Math.abs(this.quantity - previousQuantity),
            adjustedBy: this.updatedBy || null // Ensure you handle 'updatedBy' externally (perhaps via a controller)
        });

        // Update last restocked date if quantity increases
        if (this.quantity > previousQuantity) {
            this.lastRestocked = Date.now();
        }
    }

    next();
});

// Model for Inventory
const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
