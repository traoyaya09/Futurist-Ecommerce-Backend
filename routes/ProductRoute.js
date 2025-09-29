const express = require('express');
const productController = require('../controllers/ProductsController');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

const router = express.Router();

// ------------------------------
// Public Routes (specific first)
// ------------------------------

// Get featured products
router.get('/featured', productController.getFeaturedProducts);

// Search for products
router.get('/search', productController.searchProducts);

// Get products by category
router.get('/category/:category', productController.getProductsByCategory);

// Get all products
router.get('/', productController.getAllProducts);

// Get a single product by ID (generic route, last)
router.get('/:id', productController.getProductById);

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
