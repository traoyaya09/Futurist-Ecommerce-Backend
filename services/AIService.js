// backend/services/AIService.js
const axios = require("axios");
const CartModel = require("../models/CartModel");
const CartController = require("../controllers/CartController");
const ProductsController = require("../controllers/ProductsController");
const { getGPTSApiConfig } = require("../utils/gptsApi");
const { generateAutonomousOrchestrationPrompt } = require("../utils/orchestrationPrompt");

let getSocketInstance, emitWithConfirm;
const lazySocketHelpers = () => {
  if (!getSocketInstance || !emitWithConfirm) {
    ({ getSocketInstance, emitWithConfirm } = require("../socket"));
  }
  return getSocketInstance();
};

// In-memory rate limiter and catalog cache
const userRateLimiter = new Map();
let cachedCatalogSummary = null;
let catalogCacheTime = 0;
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const safeParseGPTS = (raw, defaultCart) => {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      output: parsed.output || "",
      intent: parsed.intent || "chat",
      action: parsed.action,
      productId: parsed.productId,
      quantity: parsed.quantity,
      promoCode: parsed.promoCode,
      suggestions: parsed.suggestions || [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      cart: parsed.cart || defaultCart,
    };
  } catch (err) {
    console.warn("[AIService] ⚠️ Malformed GPTS output, falling back to defaults.", err.message);
    return { output: "AI response malformed.", intent: "chat", products: [], cart: defaultCart };
  }
};

const emitThrottled = async (userId, event, payload, minInterval = 50, fastMode = false) => {
  const now = Date.now();
  const lastEmit = userRateLimiter.get(userId) || 0;
  if (!fastMode && now - lastEmit < minInterval) return;
  userRateLimiter.set(userId, now);
  await emitWithConfirm(`user:${userId}`, event, payload);
};

class AIService {
  /** Get cached catalog summary (refresh every 5 mins) */
  static async getCatalogSummary() {
    const now = Date.now();
    if (!cachedCatalogSummary || now - catalogCacheTime > CATALOG_CACHE_TTL_MS) {
      cachedCatalogSummary = await ProductsController.getCatalogSummaryForAI();
      catalogCacheTime = now;
    }
    return cachedCatalogSummary;
  }

  /** Ensure user memory has personality object (backfill on-the-fly) */
  static async ensurePersonality(memory) {
    memory.personality ||= {};
    memory.personality.name ||= "Guest";
    memory.personality.favoriteCategories ||= [];
    memory.personality.cartSummary ||= "Cart empty";
    memory.personality.catalogSummary ||= await AIService.getCatalogSummary();
  }

  /** Main AI handler */
  static async handleUserInput(userId, input, confirmAction = false, onPartialMessage, fastMode = false) {
    if (!userId || !input) throw new Error("userId and input are required");

    const io = lazySocketHelpers();
    const userRoom = `user:${userId}`;
    const adminRoom = "admin:dashboard";
    const UserMemory = require("../models/UserMemoryModel");

    let memory = await UserMemory.findOne({ userId });
    if (!memory) memory = await UserMemory.create({ userId, messages: [] });

    await AIService.ensurePersonality(memory);
    memory.messages.push({ role: "user", content: input });
    await memory.save();

    await emitWithConfirm(userRoom, "ai:status", { status: "processing", message: "AI processing started...", timestamp: new Date() });
    await emitWithConfirm(adminRoom, "ai:adminEvent", { userId, stage: "start", inputSnippet: input.slice(0,60), timestamp: new Date() });
    if (onPartialMessage) onPartialMessage({ type: "fast", output: "Fetching recommendations..." });

    let cart = (await CartModel.findOne({ user: userId }).populate("items.productId")) || new CartModel({ user: userId });
    cart = await CartController.ensureActivePromotion(cart);
    const contextCart = await CartController.getCartSummaryDirect(userId);

    const isOrchestrationTask = (txt) => ["checkout","promo","apply","multi-item","bundle"].some(w => txt.toLowerCase().includes(w));
    const prompt = isOrchestrationTask(input)
      ? generateAutonomousOrchestrationPrompt(memory.messages.slice(-10), input)
      : `
You are a smart AI shopping assistant.
User input: ${input}
Cart Summary: ${memory.personality.cartSummary}
Catalog Summary: ${memory.personality.catalogSummary}
Cart Context: ${JSON.stringify(contextCart)}
Return a JSON response with fields:
{ intent, output, suggestions, products (optional), cart (optional), action (optional) }`;

    const { url, apiKey, model, timeoutMs, maxRetries } = getGPTSApiConfig();
    let finalParsed = { output: "", intent: "chat", products: [], cart: contextCart };

    const processStream = async (stream) => {
      let buffer = "", tokenBatch = [], batchSize = 5, lastEmitTime = Date.now();

      const emitBatch = async () => {
        if (!tokenBatch.length) return;
        const batchOutput = tokenBatch.join("");
        finalParsed.output += batchOutput;
        tokenBatch = [];

        const now = Date.now();
        const deltaTime = now - lastEmitTime;
        lastEmitTime = now;
        if (deltaTime < 100) batchSize = Math.min(batchSize + 2, 20);
        else if (deltaTime > 300) batchSize = Math.max(batchSize - 1, 2);

        const partialUpdate = { type: "token", output: batchOutput, cart: finalParsed.cart };
        if (finalParsed.products?.length) partialUpdate.products = finalParsed.products;

        await emitThrottled(userId, "ai:stream", partialUpdate, 50, fastMode);
        await emitWithConfirm(adminRoom, "ai:stream", { userId, tokenSnippet: batchOutput.slice(0,40), timestamp: new Date() });
        if (onPartialMessage) onPartialMessage(partialUpdate);
      };

      await new Promise((resolve, reject) => {
        stream.on("data", async chunk => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            const cleaned = line.replace(/^data:\s*/,"").trim();
            if (!cleaned || cleaned === "[DONE]") continue;
            try {
              const delta = JSON.parse(cleaned);
              const token = delta.choices?.[0]?.delta?.content;
              const products = delta.choices?.[0]?.delta?.products;
              if (products) finalParsed.products = products;
              if (token) {
                tokenBatch.push(token);
                if (tokenBatch.length >= batchSize) await emitBatch();
              }
            } catch(e) { console.warn("[AIService] ⚠️ Malformed JSON in stream:", e.message); }
          }
        });
        stream.on("end", async () => { await emitBatch(); resolve(); });
        stream.on("error", async err => { console.error("[AIService] ❌ Stream error:", err.message); reject(err); });
      });
    };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await axios.post(
          url,
          { model, messages: [{ role: "user", content: prompt }], stream: !!onPartialMessage },
          { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, responseType: onPartialMessage ? "stream" : "json", timeout: timeoutMs }
        );

        if (onPartialMessage && response.data.on) {
          await processStream(response.data);
        } else {
          const content = response.data?.choices?.[0]?.message?.content;
          finalParsed = safeParseGPTS(content, contextCart);
        }
        break;
      } catch(err) {
        console.warn(`[AIService] ⚠️ Attempt ${attempt+1} failed:`, err.message);
        await emitWithConfirm(adminRoom, "ai:retry", { userId, attempt: attempt+1, message: err.message, timestamp: new Date() });
        if (attempt === maxRetries-1) finalParsed.output = "AI temporarily unavailable.";
        else await new Promise(r => setTimeout(r, 500*2**attempt));
      }
    }

    finalParsed.cart = await CartController.getCartSummaryDirect(userId);

    if (finalParsed.intent === "cart" && confirmAction && finalParsed.action) {
      try {
        const { action, productId, promoCode, quantity } = finalParsed;
        switch(action){
          case "add_to_cart":
          case "update_cart":
            finalParsed.cart = await CartController.addOrUpdateProductDirect(userId, productId, quantity ?? 1);
            break;
          case "remove_from_cart":
            finalParsed.cart = await CartController.removeFromCartDirect(userId, productId);
            break;
          case "apply_promo":
            if (promoCode) finalParsed.cart = await CartController.applyPromotionDirect(userId, promoCode);
            break;
          case "checkout":
            finalParsed.cart = (await CartController.checkoutCartDirect(userId)).cart;
            break;
        }
        await emitWithConfirm(adminRoom, "ai:actionComplete", { userId, action: finalParsed.action, timestamp: new Date() });
      } catch(err) {
        console.error("[AIService] ❌ Cart action failed:", err.message);
        await emitWithConfirm(adminRoom, "ai:actionError", { userId, action: finalParsed.action, error: err.message });
      }
    }

    memory.messages.push({ role: "ai", content: finalParsed.output });
    await memory.save();

    await emitWithConfirm(userRoom, "ai:status", { status: "complete", message: "AI response ready.", outputSnippet: finalParsed.output.slice(0,80), timestamp: new Date() });
    await emitWithConfirm(adminRoom, "ai:adminEvent", { userId, stage: "complete", totalTimeMs: Date.now(), timestamp: new Date() });

    return finalParsed;
  }
}

module.exports = AIService;
