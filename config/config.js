// config/config.js
require('dotenv').config(); // Load environment variables

module.exports = {
  app: {
    name: "FUTURIST",
    port: process.env.PORT || 8080,
    environment: process.env.NODE_ENV || "development",
    baseURL: process.env.BASE_URL || "http://localhost:8080",
  },

  database: {
    mongoURI: process.env.MONGO_URI || "mongodb://localhost:27017/futurist",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "supersecretkey",
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "supersecretkey",
  },

  cors: {
  allowedOrigins: [
    "http://localhost:5173", // Vite dev server
    "http://localhost:3000", // fallback dev
    "https://futurist-ai-git-develop-yaya-traores-projects-dccd4831.vercel.app",
    "https://futurist-aw5fi8g7e-yaya-traores-projects-dccd4831.vercel.app",
  ],
},


  paypal: {
    clientID: process.env.PAYPAL_CLIENT_ID || "AfZrobvCe6f5la6GSpAb32b_GRB_aezws3qayjz369YzybdScZ4H-hQFZ2VGMLE6ZDDMtfOgCKWRzjs8",
    secret: process.env.PAYPAL_SECRET || "EIg1RTQyD0zHU71YV72twM0SmeeuzZmE8tVtWhBCG7SkICStGywsCVi9p1OQC0j3I6fwp1kGhUp9JGCJ",
    mode: process.env.PAYPAL_MODE || "sandbox",
    webhookID: process.env.PAYPAL_WEBHOOK_ID || "your_paypal_webhook_id",
  },

  payment: {
    supportedMethods: ["Credit Card", "PayPal", "Bank Transfer", "Cash on Delivery", "Cryptocurrency"],
    defaultCurrency: process.env.DEFAULT_CURRENCY || "USD",
    multiCurrencySupport: ["USD", "FCFA", "RMB"],
  },

  ngrok: {
    authToken: process.env.NGROK_AUTH_TOKEN || "",
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
  },

  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
  },

  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.FROM_EMAIL || "no-reply@futurist.com",
  },

  cloudStorage: {
    provider: process.env.CLOUD_STORAGE_PROVIDER || "aws",
    awsBucket: process.env.AWS_S3_BUCKET || "your-s3-bucket-name",
  },
};
