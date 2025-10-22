const rateLimit = require('express-rate-limit');

// Login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again later."
});

// General API limiter (per hour, for low-traffic endpoints)
const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100
});

// High-traffic endpoints limiter (products, search, infinite scroll)
const productsLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 5,
  message: { status: 'error', message: 'Too many requests. Slow down!' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, generalLimiter, productsLimiter };
