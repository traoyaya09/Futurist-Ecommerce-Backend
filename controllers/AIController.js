// backend/controllers/AIController.js
const AIService = require('../services/AIService');
const UserMemory = require('../models/UserMemoryModel');
const CartModel = require('../models/CartModel');
const { getSocketInstance } = require('../socket');

class AIController {
  static async query(req, res) {
    try {
      console.log("---- AIController.query START ----");
      console.log("req.user:", req.user);
      console.log("req.body:", req.body);

      const userId = req.user?._id;
      const { input, confirmAction } = req.body;

      if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });
      if (!input) return res.status(400).json({ success: false, message: "Input is required" });

      // --- Ensure UserMemory exists
      let memory = await UserMemory.findOne({ userId });
      if (!memory) {
        memory = await UserMemory.create({ userId });
        console.log("Created new UserMemory for user:", userId);
      }

      // --- Sync memory with current cart
      await UserMemory.syncMemoryCart(userId);

      // --- Get latest memory after sync
      memory = await UserMemory.findOne({ userId });

      const io = getSocketInstance();

      // --- Call AI service with live message callback
      const aiResponse = await AIService.handleUserInput(userId, input, confirmAction, (partialMessage) => {
        try {
          if (io) {
            io.to(userId.toString()).emit("ai:message", {
              role: "ai",
              content: partialMessage,
              partial: true,
            });
          }
        } catch (emitErr) {
          console.warn("Failed to emit partial AI message:", emitErr.message);
        }
      });

      // --- Fetch cart snapshot
      const cart = await CartModel.findOne({ user: userId }).populate("items.product");
      const normalizedCart = cart
        ? {
            items: cart.items.map(i => ({
              productId: i.product?._id,
              name: i.product?.name || "Unnamed Product",
              quantity: i.quantity,
              price: i.price,
              total: i.total,
            })),
            appliedPromotion: cart.appliedPromotion,
            discount: cart.discount,
            finalTotal: cart.finalTotal,
          }
        : { items: [], appliedPromotion: null, discount: 0, finalTotal: 0 };

      // --- Emit final AI message
      try {
        if (io) {
          io.to(userId.toString()).emit("ai:message", {
            role: "ai",
            content: aiResponse.output,
            aiData: aiResponse,
            partial: false,
          });
        }
      } catch (emitErr) {
        console.warn("Failed to emit final AI message:", emitErr.message);
      }

      return res.status(200).json({
        success: true,
        data: {
          aiResponse,
          userMemory: memory,
          cart: normalizedCart,
        },
      });
    } catch (err) {
      console.error("AIController query error:", err);
      return res.status(500).json({ success: false, message: "AI processing failed" });
    }
  }
}

module.exports = AIController;
