const express = require('express');
const productController = require('../controllers/ProductsController');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

const router = express.Router();

// Get all products with optional filters, sorting, and pagination (Public Route)
router.get('/', productController.getAllProducts);

// Get a single product by ID (Public Route)
router.get('/:id', productController.getProductById);

// Create a new product (Admin Only)
router.post('/', authenticate, authorize('Admin'), productController.createProduct);

// Update a product by ID (Admin Only)
router.put('/:id', authenticate, authorize('Admin'), productController.updateProductById);

// Delete a product by ID (Admin Only)
router.delete('/:id', authenticate, authorize('Admin'), productController.deleteProductById);

// Get products by category (Public Route)
router.get('/category/:category', productController.getProductsByCategory);

// Search for products by name or description (Public Route)
router.get('/search', productController.searchProducts);

// Get featured products (Public Route)
router.get('/featured', productController.getFeaturedProducts);

module.exports = router;