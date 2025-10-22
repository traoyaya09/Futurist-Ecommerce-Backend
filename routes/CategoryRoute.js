const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/CategoryController');

// Category routes

// Create a new category
router.post('/', categoryController.createCategory);  

// Get all categories with pagination and filtering
router.get('/', categoryController.getAllCategories);  

// Get full category tree
router.get('/tree', categoryController.getCategoryTree);  

// Get category by slug (SEO-friendly)
router.get('/slug/:slug', categoryController.getCategoryBySlug);  

// Get category by ID
router.get('/:id', categoryController.getCategoryById);  

// Update category by ID
router.put('/:id', categoryController.updateCategoryById);  

// Delete category by ID
router.delete('/:id', categoryController.deleteCategoryById);  

module.exports = router;
