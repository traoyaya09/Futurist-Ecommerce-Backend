require("dotenv").config();
const express = require("express");
const http = require("http");
const colors = require("colors");
const morgan = require("morgan");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("express-async-handler");
const NodeCache = require("node-cache");

const connectDB = require("./config/db.js");
const config = require("./config/config.js");
const { getCSPDirectives, getOrigins } = require("./utils/cspDirectives");
const errorHandler = require("./middleware/errorHandling.js");
const logger = require("./middleware/logger.js");
const securityHeaders = require("./middleware/securityHeaders.js");
const { initSocket } = require("./socket");

// ------------------------------
// Connect to MongoDB
// ------------------------------
connectDB();

// ------------------------------
// Create Express app
// ------------------------------
const app = express();
const { frontends } = getOrigins(config.app.environment);

// ------------------------------
// Security Middlewares
// ------------------------------
app.use(
  helmet({
    contentSecurityPolicy: { directives: getCSPDirectives(config.app.environment) },
  })
);
app.use(securityHeaders);
app.use(compression());
app.use(logger);

// ------------------------------
// Request parsing
// ------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------
// Logging in development
// ------------------------------
if (config.app.environment === "development") app.use(morgan("dev"));

// ------------------------------
// CORS Setup
// ------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (frontends.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ------------------------------
// Rate Limiting
// ------------------------------
// Global limiter for low-traffic endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
});
app.use(globalLimiter);

// High-traffic endpoint limiter (e.g., /products)
const productsLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 5, // max 5 requests per IP per second
  message: { status: "error", message: "Too many requests. Slow down!" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------
// Simple cache for products pages
// ------------------------------
const productCache = new NodeCache({ stdTTL: 10 }); // 10 seconds TTL

const cacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;
  const cached = productCache.get(key);
  if (cached) return res.json(cached);
  // Override res.json to cache the response
  res.originalJson = res.json;
  res.json = (body) => {
    productCache.set(key, body);
    return res.originalJson(body);
  };
  next();
};

// ------------------------------
// API Routes
// ------------------------------
app.use("/api/v1/ai", require("./routes/aiRoutes.js"));
app.use("/api/v1/auth", require("./routes/AuthRoute.js"));
app.use("/api/v1/admin", require("./routes/adminRoute.js"));
app.use("/api/v1/analytics", require("./routes/AnalyticsRoute.js"));
app.use("/api/v1/brands", require("./routes/BrandRoute.js"));
app.use("/api/v1/carts", require("./routes/CartRoute.js"));
app.use("/api/v1/categories", require("./routes/CategoryRoute.js"));
app.use("/api/v1/chat", require("./routes/ChatRoute.js"));
app.use("/api/v1/content", require("./routes/ContentRoute.js"));
app.use("/api/v1/info", require("./routes/InfoRoute.js"));
app.use("/api/v1/inventory", require("./routes/InventoryRoute.js"));
app.use("/api/v1/marketing", require("./routes/MarketingRoute.js"));
app.use("/api/v1/notifications", require("./routes/NotificationRoute.js"));
app.use("/api/v1/orders", require("./routes/OrderRoute.js"));
app.use("/api/v1/payments", require("./routes/PaymentRoute.js"));

// High-traffic products route with limiter + cache
app.use("/api/v1/products", productsLimiter, cacheMiddleware, require("./routes/ProductRoute.js"));

app.use("/api/v1/promotions", require("./routes/PromotionRoute.js"));
app.use("/api/v1/returns", require("./routes/ReturnRoute.js"));
app.use("/api/v1/reviews", require("./routes/ReviewRoute.js"));
app.use("/api/v1/settings", require("./routes/SettingsRoute.js"));
app.use("/api/v1/shipping", require("./routes/ShippingRoute.js"));
app.use("/api/v1/support", require("./routes/SupportTicketRoute.js"));
app.use("/api", require("./routes/SearchRoute.js"));
app.use("/api/v1/transactions", require("./routes/TransactionRoute.js"));
app.use("/api/v1/users", require("./routes/UserRoute.js"));

// ------------------------------
// Example protected route
// ------------------------------
const { authenticate } = require("./middleware/authentication.js");
const { authorize } = require("./middleware/authorization.js");

app.get("/api/v1/protected", authenticate, (req, res) => {
  res.json({ success: true, message: "You have accessed a protected route!" });
});

// Example admin route
app.get(
  "/api/v1/admin",
  authenticate,
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    res.status(200).json({ message: "You have admin access!" });
  })
);

// Home route
app.get("/", (req, res) => {
  res.send("<h1>Welcome to Futurist E-commerce API</h1>");
});

// ------------------------------
// Error handling
// ------------------------------
app.use(errorHandler);
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ------------------------------
// HTTP server + Socket.IO
// ------------------------------
const server = http.createServer(app);
initSocket(server);

// ------------------------------
// Start server
// ------------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.app.environment} mode on port ${PORT}`.green.bold);
  console.log("JWT_SECRET loaded:", !!process.env.JWT_SECRET);
});
