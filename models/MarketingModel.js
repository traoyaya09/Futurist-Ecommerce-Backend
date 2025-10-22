const mongoose = require('mongoose');

const marketingSchema = new mongoose.Schema({
    campaignName: {
        type: String,
        required: [true, 'Campaign name is required'],
        trim: true,
        maxlength: [100, 'Campaign name must be less than 100 characters'],
        index: true  // Indexing for faster search
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        validate: {
            validator: function(value) {
                return value < this.endDate;  // Ensure startDate is before endDate
            },
            message: 'Start date must be before the end date'
        }
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
            validator: function(value) {
                return value > this.startDate;  // Ensure endDate is after startDate
            },
            message: 'End date must be after the start date'
        }
    },
    description: {
        type: String,
        maxlength: [500, 'Description can be up to 500 characters']
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'completed'],
        default: 'inactive'
    },
    budget: {
        type: Number,
        min: [0, 'Budget must be a positive number'],
        default: 0
    }
}, { timestamps: true });

// Virtual field to calculate the campaign duration
marketingSchema.virtual('duration').get(function() {
    if (this.startDate && this.endDate) {
        return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));  // Duration in days
    }
    return null;
});

// Indexing for commonly searched fields
marketingSchema.index({ campaignName: 1, startDate: -1 });

const Marketing = mongoose.model('Marketing', marketingSchema);

module.exports = Marketing;
