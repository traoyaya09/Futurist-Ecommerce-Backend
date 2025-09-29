// backend/services/AIService.js
const OpenAI = require('openai');
const UserMemory = require('../models/UserMemoryModel');
const CartController = require('../controllers/CartController');
const ProductsController = require('../controllers/ProductsController');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const aiCache = new Map();

class AIService {
  /**
   * Handle user input with:
   * - Fast-path immediate reply
   * - Concurrent background + quick action detection
   * - Full-path streaming with incremental product/cart updates
   * - Resume from last successful JSON chunk if streaming fails
   */
  static async handleUserInput(userId, input, confirmAction = false, onPartialMessage) {
    if (!input) throw new Error("Input is required");

    const cacheKey = `${userId}:${input.toLowerCase().trim()}`;
    if (aiCache.has(cacheKey)) return aiCache.get(cacheKey);

    // --- Load/create memory
    let memory = await UserMemory.findOne({ userId }) ||
                 await UserMemory.create({
                   userId,
                   messages: [],
                   personality: {
                     name: null,
                     favoriteCategories: [],
                     cartSummary: 'Cart is empty',
                     catalogSummary: 'No products'
                   }
                 });

    memory.personality ||= {
      name: null,
      favoriteCategories: [],
      cartSummary: 'Cart is empty',
      catalogSummary: 'No products'
    };

    memory.messages.push({ role: 'user', content: input });
    const recentMessages = memory.messages.slice(-5);
    const userName = memory.personality.name || 'there';
    await memory.save();

    // --- Step 1: Fast-path reply
    const fastOutput = "Hi! I'm fetching recommendations for you...";
    if (onPartialMessage) onPartialMessage({ type: 'fast', output: fastOutput });
    memory.messages.push({ role: 'ai', content: fastOutput });
    await memory.save();

    // --- Step 2 + 3: Background updates + quick action concurrently
    let actionRequired = false;
    await Promise.allSettled([
      (async () => {
        try {
          const [cartSummary, catalogSummary] = await Promise.all([
            CartController.getUserCartSummary(userId),
            ProductsController.getCatalogSummaryForAI()
          ]);
          memory.personality.cartSummary = cartSummary || memory.personality.cartSummary;
          memory.personality.catalogSummary = catalogSummary || memory.personality.catalogSummary;
          await memory.save();
        } catch (err) {
          console.warn('Background update failed:', err.message);
        }
      })(),
      (async () => {
        try {
          const quickResp = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'user', content: `Detect if input requires cart/product/promo/checkout/gift action. Respond JSON { "actionRequired": true|false }. Input: "${input}"` }
            ],
            max_tokens: 10,
            timeout: 20000
          });
          actionRequired = JSON.parse(quickResp.choices[0].message.content)?.actionRequired || false;
        } catch (err) {
          console.warn('Quick-action detection failed:', err.message);
          const lower = input.toLowerCase();
          if (['buy','cart','product','clothes','shirt','pants'].some(w => lower.includes(w))) {
            actionRequired = true;
          }
        }
      })()
    ]);

    // --- Step 4: Full-path streaming with retry + resumeFromLastChunk
    let structuredOutput = {
      intent: 'support',
      action: null,
      output: fastOutput,
      products: [],
      cart: null,
      suggestions: [],
      requiresConfirmation: false,
    };

    if (!actionRequired) {
      aiCache.set(cacheKey, structuredOutput);
      return structuredOutput;
    }

    const fullPromptBase = `
Detect intent (cart/product/promo/checkout/gift) and suggest products/promotions/upsells.
Ask for confirmation before performing any action.
User name: ${userName}
Favorites: ${memory.personality.favoriteCategories.join(', ') || 'none'}
Cart summary: ${memory.personality.cartSummary}
Catalog summary: ${memory.personality.catalogSummary}
Recent messages: ${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
Input: "${input}"
Respond strictly in JSON format.
`;

    let partialText = '';
    let lastSentJSON = {};
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        // If resuming from last chunk, prepend lastSentJSON to prompt
        const resumePrompt = lastSentJSON.output
          ? fullPromptBase + `\nPreviously sent JSON: ${JSON.stringify(lastSentJSON)}\nContinue generating JSON from here.`
          : fullPromptBase;

        const stream = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: resumePrompt }],
          stream: true,
          signal: controller.signal
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (!delta) continue;

          partialText += delta;
          const lastClosing = partialText.lastIndexOf('}');
          if (lastClosing !== -1) {
            const candidate = partialText.slice(0, lastClosing + 1);
            try {
              const parsed = JSON.parse(candidate);
              lastSentJSON = parsed;

              // Incremental product fetch
              let products = [];
              if (parsed.intent === 'product') {
                products = parsed.query
                  ? await ProductsController.searchProductsByQuery(parsed.query)
                  : await ProductsController.getFeaturedProductsForAI();
              }

              // Incremental cart preview
              let cart = null;
              if (parsed.intent === 'cart') {
                cart = await CartController.previewCartAction(userId, parsed);
              }

              if (onPartialMessage) {
                onPartialMessage({ type: 'full', output: parsed, products, cart });
              }
            } catch {
              // Ignore incomplete JSON
            }
          }
        }

        clearTimeout(timeoutId);
        break; // success, exit retry loop
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`Full-path streaming attempt ${attempt + 1} failed:`, err.message);
        if (attempt === maxRetries) lastSentJSON.output = "AI is unavailable. Try again later.";
        else await new Promise(r => setTimeout(r, 500)); // wait before retry
      }
    }

    // --- Final memory update
    memory.personality.favoriteCategories = [
      ...new Set([
        ...(memory.personality.favoriteCategories || []),
        ...(lastSentJSON.suggestions?.map(s => s.category).filter(Boolean) || [])
      ])
    ];
    memory.messages.push({ role: 'ai', content: lastSentJSON.output || fastOutput });
    await memory.save();

    structuredOutput = {
      intent: lastSentJSON.intent || 'support',
      action: lastSentJSON.action || null,
      output: lastSentJSON.output || fastOutput,
      suggestions: lastSentJSON.suggestions || [],
      requiresConfirmation: lastSentJSON.requiresConfirmation ?? false,
      products: lastSentJSON.products || [],
      cart: lastSentJSON.cart || null
    };

    // Execute confirmed cart actions
    if (lastSentJSON.intent === 'cart' && confirmAction) {
      try {
        switch (lastSentJSON.action) {
          case 'add_to_cart':
          case 'update_cart':
            structuredOutput.cart = await CartController.addOrUpdateProductDirect(
              userId, lastSentJSON.productId, lastSentJSON.quantity ?? 1
            );
            break;
          case 'remove_from_cart':
            structuredOutput.cart = await CartController.removeFromCartDirect(userId, lastSentJSON.productId);
            break;
          case 'apply_promo':
            if (lastSentJSON.promoCode) {
              structuredOutput.cart = await CartController.applyPromotionDirect(userId, lastSentJSON.promoCode);
            }
            break;
          case 'checkout':
            structuredOutput.cart = await CartController.checkoutCartDirect(userId);
            break;
        }
        if (lastSentJSON.action) await UserMemory.syncMemoryCart(userId);
      } catch (err) {
        console.error('Cart action failed:', err.message);
      }
    }

    aiCache.set(cacheKey, structuredOutput);
    return structuredOutput;
  }
}

module.exports = AIService;
