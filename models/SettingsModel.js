const mongoose = require('mongoose');

// Define the schema for settings with additional fields and metadata
const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true, // Ensure keys are unique
    index: true,  // Add an index for faster lookups
  },
  value: {
    type: String,
    required: true,
  },
  valueType: {
    type: String,
    enum: ['String', 'Number', 'Boolean', 'JSON'], // Allow settings to store various data types
    default: 'String',
    required: true,
  },
  isSensitive: {
    type: Boolean,
    default: false, // Indicates if the value is sensitive (for encryption purposes)
  },
  description: {
    type: String,
    default: '', // Optional description of the setting, useful for documentation purposes
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Track who last updated the setting
    default: null,
  },
  lastAccessed: {
    type: Date, // Track when the setting was last accessed
    default: null,
  },
}, { timestamps: true }); // Timestamps for createdAt and updatedAt fields

// Middleware to automatically update the `lastAccessed` field
settingSchema.pre('findOne', function (next) {
  this.update({}, { $set: { lastAccessed: Date.now() } });
  next();
});

// Method to get the value based on its type (parses JSON or returns the correct data type)
settingSchema.methods.getValue = function () {
  switch (this.valueType) {
    case 'Number':
      return parseFloat(this.value);
    case 'Boolean':
      return this.value === 'true';
    case 'JSON':
      try {
        return JSON.parse(this.value);
      } catch (error) {
        return this.value; // Return the raw value if JSON parsing fails
      }
    default:
      return this.value;
  }
};

// Method to update the value and ensure it's stored as the correct type
settingSchema.methods.setValue = function (newValue) {
  if (this.valueType === 'JSON' && typeof newValue !== 'string') {
    this.value = JSON.stringify(newValue); // Store JSON objects as strings
  } else {
    this.value = newValue.toString();
  }
};

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
