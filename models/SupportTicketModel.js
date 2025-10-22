const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The support agent responding
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const supportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Open', 'In Progress', 'Closed', 'Resolved'], 
    default: 'Open' 
  },
  priority: {
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Critical'], 
    default: 'Medium',
  },
  assignedAgent: { 
    type: mongoose.Schema.Types.ObjectId, ref: 'User', 
    default: null 
  }, // Tracks the support agent assigned to the ticket
  responses: [responseSchema], // Conversation history between user and agent
  resolutionDate: { 
    type: Date, 
    default: null 
  }, // Tracks when the issue was resolved
  feedback: {
    rating: { type: Number, min: 1, max: 5 }, // Optional user feedback on the resolution
    comment: { type: String },
  },
  escalation: { 
    type: Boolean, 
    default: false 
  }, // Tracks if the issue has been escalated
}, { timestamps: true });

supportSchema.methods.addResponse = function(agentId, message) {
  this.responses.push({ agent: agentId, message });
  return this.save();
};

supportSchema.methods.closeTicket = function() {
  this.status = 'Closed';
  this.resolutionDate = new Date();
  return this.save();
};

supportSchema.methods.markInProgress = function() {
  this.status = 'In Progress';
  return this.save();
};

supportSchema.methods.escalate = function() {
  this.escalation = true;
  return this.save();
};

const Support = mongoose.model('Support', supportSchema);

module.exports = Support;
