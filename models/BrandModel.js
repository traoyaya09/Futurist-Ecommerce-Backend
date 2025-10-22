const mongoose = require('mongoose');
const validator = require('validator'); // Import validator library for robust validation

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Brand name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Brand name must be less than 100 characters'],
    index: true,
  },
  description: {
    type: String,
    maxlength: [500, 'Description must be less than 500 characters'],
    trim: true,
  },
  logoUrl: {
    type: String,
    validate: {
      validator: validator.isURL,
      message: 'Invalid URL for logo',
    },
  },
  establishedYear: {
    type: Number,
    min: [1800, 'Established year cannot be before 1800'],
    max: [new Date().getFullYear(), 'Established year cannot be in the future'],
  },
  website: {
    type: String,
    validate: {
      validator: validator.isURL,
      message: 'Invalid URL for website',
    },
  },
}, { timestamps: true });

// Static method for searching brands with pagination and filtering
brandSchema.statics.findBrands = function ({ query = '', page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;
  const regexQuery = new RegExp(query, 'i');
  return this.find({ name: regexQuery })
    .skip(skip)
    .limit(limit)
    .exec();
};

// Instance method for updating brand details
brandSchema.methods.updateDetails = function (updateData) {
  Object.assign(this, updateData);
  return this.save();
};

// Indexes for optimization

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand;
