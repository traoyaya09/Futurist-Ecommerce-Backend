const express = require('express');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');

const productController = require('../controllers/ProductsController');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

const router = express.Router();

// ------------------------------
// Cache setup
// ------------------------------
const productsCache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // cache for 1 min

// ------------------------------
// Rate limiters
// ------------------------------
// High traffic: /products
const productsLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 5,
  message: { status: 'error', message: 'Too many requests. Slow down!' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------
// Middleware to use cache
// ------------------------------
const cacheMiddleware = (req, res, next) => {
  const key = `products:${req.originalUrl}`;
  const cached = productsCache.get(key);
  if (cached) {
    return res.json(cached);
  }
  // Override res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    productsCache.set(key, body);
    return originalJson(body);
  };
  next();
};

// ------------------------------
// Public Routes (specific first)
// ------------------------------

// Get featured products
router.get('/featured', productsLimiter, cacheMiddleware, productController.getFeaturedProducts);

// Search for products
router.get('/search', productsLimiter, cacheMiddleware, productController.searchProducts);

// Get products by category
router.get('/category/:category', productsLimiter, cacheMiddleware, productController.getProductsByCategory);

// Get all products
router.get('/', productsLimiter, cacheMiddleware, productController.getAllProducts);

// Get categories (cached automatically inside controller)
router.get('/categories', productsLimiter, productController.getCategoriesFromProducts);

// Get a single product by ID (generic route, last)
router.get('/:id', productsLimiter, productController.getProductById);

// ------------------------------
// User Interaction Routes (logged)
// ------------------------------

// Log a purchase for a product
router.post('/:id/purchase', authenticate, productController.purchaseProduct);

// ------------------------------
// Admin Routes (protected)
// ------------------------------

// Create a new product
router.post('/', authenticate, authorize('Admin'), productController.createProduct);

// Update a product by ID
router.put('/:id', authenticate, authorize('Admin'), productController.updateProductById);

// Delete a product by ID
router.delete('/:id', authenticate, authorize('Admin'), productController.deleteProductById);

module.exports = router;
