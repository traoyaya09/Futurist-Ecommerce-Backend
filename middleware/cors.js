// middleware/cors.js
const cors = require("cors");
const config = require("../config/config");

const allowedOrigins = config.cors.allowedOrigins;

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests without origin (Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS BLOCKED] Origin not allowed: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // Allow cookies / JWT auth
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204, // Preflight
});

// Explicitly handle preflight requests for all routes
function applyCors(app) {
  app.use(corsMiddleware);
  app.options("*", corsMiddleware);
}

module.exports = applyCors;
