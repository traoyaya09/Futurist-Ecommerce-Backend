// backend/utils/orchestrationPrompt.js

/**
 * Generates a GPT prompt for autonomous orchestration tasks
 * @param {Array} recentMessages - Array of recent user/AI messages
 * @param {String} userInput - The current user input
 * @returns {String} - GPT prompt string
 */ 
function generateAutonomousOrchestrationPrompt(recentMessages, userInput) {
  const conversationContext = recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  return `
You are an intelligent AI shopping assistant capable of autonomous orchestration.
Recent conversation:
${conversationContext}

Current user request: "${userInput}"

Instructions:
1. Analyze the user's intent and shopping context.
2. Consider cart contents, promotions, bundles, and stock availability.
3. Generate a JSON response with the following fields:
   - intent: 'chat' | 'cart'
   - action: if intent is 'cart', specify 'add_to_cart', 'update_cart', 'remove_from_cart', 'apply_promo', or 'checkout'
   - productId: if applicable
   - quantity: if applicable
   - promoCode: if applicable
   - output: human-readable response for the user
   - products: optional product suggestions
   - cart: optional updated cart preview
4. Make recommendations concise, actionable, and aligned with the user's context.
5. Always maintain JSON-valid output.
`;
}

module.exports = { generateAutonomousOrchestrationPrompt };
