const mongoose = require('mongoose');

// Define the schema for the analytics data
const analyticsSchema = new mongoose.Schema({
  pageName: { type: String, required: true },
  pageViews: { type: Number, default: 0 },
  uniqueVisitors: { type: Number, default: 0 },
  bounceRate: { type: Number, default: 0 }, // Percentage of visitors who leave without interacting
  averageSessionTime: { type: Number, default: 0 }, // In seconds
  conversionRate: { type: Number, default: 0 }, // Percentage of visitors who perform a desired action (e.g., purchase)
  devices: { 
    mobile: { type: Number, default: 0 },
    desktop: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  }, // Track device types
  geoLocation: {
    country: { type: String, default: '' }, // Country of the visitor
    city: { type: String, default: '' } // City of the visitor
  },
  trafficSource: { 
    type: String, 
    enum: ['organic', 'paid', 'direct', 'social', 'referral'], 
    default: 'organic' 
  }, // Source of the traffic
}, { timestamps: true }); // Automatically include createdAt and updatedAt

// Create the model from the schema
const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;
