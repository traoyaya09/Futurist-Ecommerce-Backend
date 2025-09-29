const categoryHelper = require('../helpers/CategoryHelper');
const { getSocketInstance } = require('../socket');

const categoryController = {
  // Create a new category
  createCategory: async (req, res) => {
    try {
      const newCategory = await categoryHelper.createCategory(req.body);

      getSocketInstance().emit('category:created', newCategory);

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: newCategory,
      });
    } catch (error) {
      console.error('Error creating category:', error.message);
      res.status(500).json({ success: false, message: 'Error creating category' });
    }
  },

  // Get category by ID
  getCategoryById: async (req, res) => {
    try {
      const category = await categoryHelper.getCategoryById(req.params.id);
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

      res.status(200).json({ success: true, data: category });
    } catch (error) {
      console.error('Error fetching category by ID:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching category' });
    }
  },

  // Get category by slug
  getCategoryBySlug: async (req, res) => {
    try {
      const category = await categoryHelper.getCategoryBySlug(req.params.slug);
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

      res.status(200).json({ success: true, data: category });
    } catch (error) {
      console.error('Error fetching category by slug:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching category' });
    }
  },

  // Get all categories with pagination and optional filtering
  getAllCategories: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const query = req.query.query || '';

      const categoriesResult = await categoryHelper.getAllCategories(query, page, limit);

      res.status(200).json({
        success: true,
        data: categoriesResult.categories,
        pagination: categoriesResult.pagination,
      });
    } catch (error) {
      console.error('Error fetching all categories:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
  },

  // Get full category tree
  getCategoryTree: async (req, res) => {
    try {
      const tree = await categoryHelper.getCategoryTree();
      res.status(200).json({ success: true, data: tree });
    } catch (error) {
      console.error('Error fetching category tree:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching category tree' });
    }
  },

  // Update category by ID
  updateCategoryById: async (req, res) => {
    try {
      const updatedCategory = await categoryHelper.updateCategoryById(req.params.id, req.body);
      if (!updatedCategory) return res.status(404).json({ success: false, message: 'Category not found' });

      getSocketInstance().emit('category:updated', updatedCategory);

      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: updatedCategory,
      });
    } catch (error) {
      console.error('Error updating category:', error.message);
      res.status(500).json({ success: false, message: 'Error updating category' });
    }
  },

  // Delete category by ID
  deleteCategoryById: async (req, res) => {
    try {
      const result = await categoryHelper.deleteCategoryById(req.params.id);

      getSocketInstance().emit('category:deleted', req.params.id);

      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      console.error('Error deleting category:', error.message);
      res.status(500).json({ success: false, message: 'Error deleting category' });
    }
  },
};

module.exports = categoryController;
