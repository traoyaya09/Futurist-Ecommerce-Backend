const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only allow 5 attempts per 15 minutes
  message: "Too many login attempts. Please try again later."
});

const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100 // Allow 100 requests per hour
});

module.exports = { loginLimiter, generalLimiter };
