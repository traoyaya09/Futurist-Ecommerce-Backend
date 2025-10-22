require("dotenv").config();

function getGPTSApiConfig() {
  let base = process.env.GPTS_API_BASE_URL?.replace(/\/$/, "") || "https://api.gptsapi.net/v1";
  // ensure we always end up with /v1/chat/completions
  const url = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;

  console.log("[GPTS API CONFIG]", {
    url,
    model: process.env.GPTS_API_MODEL,
    keyLoaded: !!process.env.GPTS_API_KEY,
  });

  return {
    url,
    apiKey: process.env.GPTS_API_KEY,
    model: process.env.GPTS_API_MODEL || "gpt-4o-mini",
    timeoutMs: Number(process.env.GPTS_API_TIMEOUT_MS) || 20000,
    maxRetries: Number(process.env.GPTS_API_MAX_RETRIES) || 3,
  };
}

module.exports = { getGPTSApiConfig };
