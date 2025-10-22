// backend/models/AuditLogModel.js
const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  total: { type: Number, required: true },
  promotionApplied: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  stockStatus: { type: String, enum: ["in_stock", "low_stock", "out_of_stock"], default: "in_stock" },
});

const RecommendedUpsellSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: { type: String, required: true },
});

const PartialUpdateSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  output: { type: String, default: "" },
  dashboardVisualization: { type: mongoose.Schema.Types.Mixed, default: {} },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
});

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionType: {
      type: String,
      enum: [
        "cart_update",
        "promotion",
        "checkout",
        "ai_suggestion",
        "analytics_update",
        "notification",
      ],
      required: true,
    },
    aiOutput: { type: String, default: "" }, // Human-readable explanation of AI reasoning
    confidence: { type: Number, min: 0, max: 100, default: 0 },
    requiresConfirmation: { type: Boolean, default: false },

    dashboardVisualization: {
      cartItems: [CartItemSchema],
      cartTotals: { type: String, default: "" }, // e.g., "$123.00 (discount $10)"
      predictedActions: [{ type: String }],
      riskAssessment: { type: String, enum: ["low", "medium", "high"], default: "low" },
      recommendedUpsells: [RecommendedUpsellSchema],
      notificationsQueued: [{ type: String }],
      analyticsUpdates: [{ type: String }],
    },

    partialUpdates: [PartialUpdateSchema],

    metadata: {
      source: { type: String, default: "AIService" },
      modelUsed: { type: String, default: "" },
      prompt: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
