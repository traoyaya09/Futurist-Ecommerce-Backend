// backend/services/OrchestrationService.js
const AIService = require("./AIService");
const AuditLogModel = require("../models/AuditLogModel");
const CartModel = require("../models/CartModel");
const CartController = require("../controllers/CartController");
const { getSocketInstance, emitWithConfirm } = require("../socket");

class OrchestrationService {

  static async handleUserInput(userId, input, confirmAction = false, partialCallback) {
    if (!userId || !input) throw new Error("userId and input are required");

    const io = getSocketInstance();
    console.log("[OrchestrationService] 🚀 handleUserInput START | userId=", userId, "| input:", input);

    let tokenBatch = [];
    let batchSize = 5; 
    let lastEmitTime = Date.now();

    const streamingCallback = async (partialMessage) => {
      if (!partialMessage?.output) return;
      tokenBatch.push(partialMessage.output);

      const now = Date.now();
      const timeSinceLastEmit = now - lastEmitTime;
      const shouldFlush = partialMessage.type !== "token" || tokenBatch.length >= batchSize || timeSinceLastEmit > 300;
      if (!shouldFlush) return;

      const batchOutput = tokenBatch.join("");
      tokenBatch = [];
      lastEmitTime = now;

      if (timeSinceLastEmit < 100) batchSize = Math.min(batchSize + 2, 20);
      else if (timeSinceLastEmit > 300) batchSize = Math.max(batchSize - 1, 2);

      const interimConfidence = partialMessage.confidence ?? 80;
      const partialDashboard = {
        cartItems: partialMessage.cart?.items || [],
        cartTotals: partialMessage.cart?.finalTotal ? `$${partialMessage.cart.finalTotal.toFixed(2)}` : "N/A",
        predictedActions: partialMessage.intent ? [partialMessage.intent] : [],
        riskAssessment: OrchestrationService.computeRisk(interimConfidence),
        recommendedUpsells: OrchestrationService.computeUpsells(partialMessage.cart),
      };

      const payload = {
        role: "ai",
        content: batchOutput,
        partial: true,
        confidence: interimConfidence,
        dashboardVisualization: partialDashboard,
      };

      const userRoom = `user:${userId}`;
      const adminRoom = "admin:dashboard";

      await Promise.all([
        emitWithConfirm(userRoom, "ai:message", payload),
        emitWithConfirm(adminRoom, "ai:partialUpdate", { userId, ...payload, timestamp: new Date() }),
        partialCallback?.(payload),
      ]);
    };

    // --- Call AIService
    let aiResponse = await AIService.handleUserInput(userId, input, confirmAction, streamingCallback);

    if (tokenBatch.length > 0) {
      await streamingCallback({ type: "token", output: tokenBatch.join("") });
    }

    console.log("[OrchestrationService] ✅ AIService completed:", {
      intent: aiResponse.intent,
      outputSnippet: aiResponse.output?.slice(0, 70),
    });

    // --- Initialize cart action metrics
    let cartActionsAttempted = 0;
    let cartActionsSucceeded = 0;

    // --- Fetch latest cart
    let cartDoc = await CartModel.findOne({ user: userId }).populate("items.productId") || new CartModel({ user: userId });
    cartDoc = await CartController.ensureActivePromotion(cartDoc);

    // --- Automatic quantity extraction from natural language
const wordNumberMap = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
};

const extractQuantityFromText = (text) => {
  if (!text) return null;
  text = text.toLowerCase();

  // Handle "half dozen"
  if (/\bhalf\s+dozen\b/.test(text)) return 6;

  // Handle "X dozen" or just "dozen"
  const dozenMatch = text.match(/\b(\d+)?\s*dozen\b/);
  if (dozenMatch) {
    const multiplier = dozenMatch[1] ? parseInt(dozenMatch[1], 10) : 1;
    return multiplier * 12;
  }

  // Match digits
  const digitMatch = text.match(/\b(\d+)\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  // Match word numbers
  const wordMatch = text.match(new RegExp(`\\b(${Object.keys(wordNumberMap).join("|")})\\b`));
  if (wordMatch) return wordNumberMap[wordMatch[1]];

  return null;
};

    if (aiResponse.intent === "cart" && aiResponse.action) {
      // Fill missing productId
      if ((aiResponse.action === "add_to_cart" || aiResponse.action === "remove_from_cart") && !aiResponse.productId) {
        if (cartDoc.items?.length) {
          aiResponse.productId = cartDoc.items[0].productId?._id;
        } else if (aiResponse.action === "add_to_cart") {
          const Product = require("../models/ProductModel");
          const firstProduct = await Product.findOne().lean();
          if (firstProduct) aiResponse.productId = firstProduct._id;
        }
      }

      // Fill missing quantity
      if (aiResponse.action === "add_to_cart" && !aiResponse.quantity) {
        const qty = extractQuantityFromText(input);
        aiResponse.quantity = qty ?? 1;
      }

      // --- Execute cart action if confirmAction
      if (confirmAction && aiResponse.action) {
        cartActionsAttempted += 1;
        try {
          switch (aiResponse.action) {
            case "add_to_cart":
              if (aiResponse.productId) await CartController.addOrUpdateProductDirect(userId, aiResponse.productId, aiResponse.quantity || 1);
              break;
            case "remove_from_cart":
              if (aiResponse.productId) await CartController.removeProductDirect(userId, aiResponse.productId);
              break;
            case "apply_promo":
              if (aiResponse.promoCode) await CartController.applyPromotionDirect(userId, aiResponse.promoCode);
              break;
            case "checkout":
              await CartController.checkoutDirect(userId);
              break;
          }
          cartActionsSucceeded += 1;
        } catch (err) {
          console.error("[OrchestrationService] Cart action failed:", err.message);
        }
      }
    }

    // --- Compute confidence
    const finalConfidence = OrchestrationService.computeConfidence(aiResponse, cartDoc);

    // --- Build dashboard
    const dashboardVisualization = {
      cartItems: cartDoc.items.map(i => ({
        productId: i.productId?._id || null,
        name: i.productId?.name || "Unnamed Product",
        price: i.price,
        quantity: i.quantity,
        total: i.total,
        promotionApplied: cartDoc.appliedPromotion || null,
        discountAmount: cartDoc.discount || 0,
        stockStatus:
          i.productId?.stock > 5 ? "in_stock" :
          i.productId?.stock > 0 ? "low_stock" : "out_of_stock",
      })),
      cartTotals: `$${cartDoc.items.reduce((sum, i) => sum + (i.total || 0), 0) - (cartDoc.discount || 0)}`,
      predictedActions: [aiResponse.intent],
      riskAssessment: OrchestrationService.computeRisk(finalConfidence),
      recommendedUpsells: OrchestrationService.computeUpsells(cartDoc),
    };

    // --- Audit log
    await AuditLogModel.create({
      userId,
      actionType: "ai_suggestion",
      confidence: finalConfidence,
      requiresConfirmation: aiResponse.intent === "cart",
      aiOutput: aiResponse.output,
      dashboardVisualization,
      metadata: {
        source: "OrchestrationService",
        modelUsed: "GPTS",
        prompt: aiResponse.prompt || "",
      },
    });

    // --- Final payload
    const finalPayload = {
      role: "ai",
      content: aiResponse.output,
      partial: false,
      confidence: finalConfidence,
      dashboardVisualization,
      aiData: aiResponse,
    };

    const userRoom = `user:${userId}`;
    const adminRoom = "admin:dashboard";

    await Promise.all([
      emitWithConfirm(userRoom, "ai:message", finalPayload),
      emitWithConfirm(adminRoom, "ai:finalUpdate", { userId, ...finalPayload, timestamp: new Date() }),
    ]);

    console.log("[OrchestrationService] ✅ handleUserInput COMPLETE for user:", userId);

    return { 
      aiResponse, 
      dashboardVisualization, 
      confidence: finalConfidence,
      cartActionsAttempted,
      cartActionsSucceeded
    };
  }

  /** Confidence scoring system */
  static computeConfidence(aiResponse, cartDoc) {
    let confidence = aiResponse.confidence ?? 80;

    cartDoc.items.forEach(i => {
      if (i.productId?.stock <= 0) confidence -= 20;
    });

    if (cartDoc.appliedPromotion && !CartController.isPromotionValid(cartDoc.appliedPromotion))
      confidence -= 15;

    if (aiResponse.intent === "cart" && aiResponse.action === "bundle" && !aiResponse.bundleComplete)
      confidence -= 20;

    const duplicates = cartDoc.items.filter((i, idx, arr) =>
      arr.findIndex(x => x.productId?._id?.toString() === i.productId?._id?.toString()) !== idx
    );
    if (duplicates.length > 0) confidence -= 10;

    return Math.max(0, Math.min(100, confidence));
  }

  /** Risk classification */
  static computeRisk(confidence) {
    if (confidence <= 40) return "high";
    if (confidence <= 70) return "medium";
    return "low";
  }

  /** Upsell generation */
  static computeUpsells(cartDoc) {
    if (!cartDoc?.items?.length) return [];

    const upsells = [];
    const seenIds = new Set();

    cartDoc.items.forEach(item => {
      item.productId?.relatedProducts?.forEach(p => {
        if (!seenIds.has(p._id.toString())) {
          seenIds.add(p._id.toString());
          upsells.push({ productId: p._id, name: p.name });
        }
      });
    });

    return upsells.slice(0, 5);
  }
}

module.exports = OrchestrationService;
