// middleware/cors.js
const cors = require("cors");
const config = require("../config/config");
const logger = require("./logger"); // use your existing logger

const allowedOrigins = config.cors.allowedOrigins;

// Optional: allow all Vercel preview URLs dynamically
const vercelOriginPattern = /^https:\/\/.*\.vercel\.app$/;

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests without origin (Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Allow whitelisted origins
    if (allowedOrigins.includes(origin) || vercelOriginPattern.test(origin)) {
      return callback(null, true);
    }

    // Only log warnings in development or as warning level in production
    if (process.env.NODE_ENV === "development") {
      console.warn(`[CORS BLOCKED] Origin not allowed: ${origin}`);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // Allow cookies / JWT auth
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204, // Preflight
});

// Apply CORS to all routes, including preflight
function applyCors(app) {
  app.use(corsMiddleware);
  app.options("*", corsMiddleware);
}

module.exports = applyCors;
