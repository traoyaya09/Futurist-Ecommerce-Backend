const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  alt: { type: String, default: 'Promotion image' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 0 }, // Higher priority means it appears first
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);
