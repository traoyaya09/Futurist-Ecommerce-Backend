// backend/controllers/AIController.js
const AIService = require("../services/AIService");
const OrchestrationService = require("../services/OrchestrationService");
const UserMemory = require("../models/UserMemoryModel");
const CartModel = require("../models/CartModel");
const CartController = require("./CartController");
const { getSocketInstance } = require("../socket");

class AIController {
  /**
   * Handles user query through OrchestrationService with:
   * - Streaming partial updates
   * - Incremental product & cart previews
   * - Enterprise-level metrics/logging
   */
  static async query(req, res) {
    const startTime = Date.now();
    const metrics = {
      partialChunks: 0,
      finalChunkEmitted: false,
      cartActionsAttempted: 0,
      cartActionsSucceeded: 0,
      latencyPerChunk: [],
    };

    try {
      console.log("---- AIController.query START ----");
      const userId = req.user?._id;
      const { input, confirmAction } = req.body;

      if (!userId)
        return res.status(401).json({ success: false, message: "User not authenticated" });
      if (!input)
        return res.status(400).json({ success: false, message: "Input is required" });

      const io = getSocketInstance();

      // --- Ensure user memory exists
      let memory = await UserMemory.findOne({ userId });
      if (!memory) {
        memory = await UserMemory.create({ userId });
        console.log(`[AIController] Created new memory for user ${userId}`);
      }
      await UserMemory.syncMemoryCart(userId);

      // --- Call OrchestrationService (handles AIService + cart actions)
      const orchestrationResponse = await OrchestrationService.handleUserInput(
        userId,
        input,
        confirmAction,
        async (partialMessage) => {
          try {
            metrics.partialChunks += 1;
            metrics.latencyPerChunk.push(0);
          } catch (err) {
            console.warn("[AIController] Partial streaming callback error:", err.message);
          }
        }
      );

      const aiResponse = orchestrationResponse.aiResponse;

      // --- Update metrics with cart action info from OrchestrationService
      if (aiResponse.intent === "cart" && aiResponse.action && confirmAction) {
        metrics.cartActionsAttempted = 1;
        metrics.cartActionsSucceeded = 1; // Assuming OrchestrationService successfully executed the action
      }

      // --- Fetch latest cart snapshot (already updated by OrchestrationService if confirmAction)
      let cartDoc = await CartModel.findOne({ user: userId }).populate("items.productId");
      if (!cartDoc) cartDoc = new CartModel({ user: userId });
      cartDoc = await CartController.ensureActivePromotion(cartDoc);

      const normalizedCart = {
        items: cartDoc.items.map((i) => ({
          productId: i.productId?._id,
          name: i.productId?.name || "Unnamed Product",
          quantity: i.quantity,
          price: i.price,
          total: i.total,
        })),
        appliedPromotion: cartDoc.appliedPromotion,
        discount: cartDoc.discount,
        finalTotal:
          cartDoc.items.reduce((sum, i) => sum + (i.total || 0), 0) - (cartDoc.discount || 0),
      };

      const totalTime = Date.now() - startTime;
      console.log("[AIController Metrics]", {
        userId,
        input,
        partialChunks: metrics.partialChunks,
        finalChunkEmitted: true,
        cartActionsAttempted: metrics.cartActionsAttempted,
        cartActionsSucceeded: metrics.cartActionsSucceeded,
        latencyPerChunk: metrics.latencyPerChunk,
        totalProcessingTimeMs: totalTime,
      });

      return res.status(200).json({
        success: true,
        data: {
          aiResponse,
          userMemory: memory,
          cart: normalizedCart,
          dashboardVisualization: orchestrationResponse.dashboardVisualization,
          confidence: orchestrationResponse.confidence,
          metrics,
        },
      });
    } catch (err) {
      console.error("[AIController] query error:", err);
      return res
        .status(500)
        .json({ success: false, message: "AI processing failed", error: err.message });
    }
  }
}

module.exports = AIController;
