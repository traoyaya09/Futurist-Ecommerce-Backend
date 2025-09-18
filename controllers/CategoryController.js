const categoryHelper = require('../helpers/CategoryHelper');
const { getSocketInstance } = require('../socket');

const categoryController = {
  /**
   * Create a new category.
   * Handles errors and ensures proper validation.
   */
  createCategory: async (req, res) => {
    try {
      const categoryData = req.body;
      const newCategory = await categoryHelper.createCategory(categoryData);

      // Emit event for new category creation
      const io = getSocketInstance();
      io.emit('category:created', newCategory);

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

  /**
   * Get category by ID.
   * Also populates parent and children categories.
   */
  getCategoryById: async (req, res) => {
    try {
      const categoryId = req.params.id;
      const category = await categoryHelper.getCategoryById(categoryId);

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error('Error fetching category by ID:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching category' });
    }
  },

  /**
   * Get category by slug.
   * Provides an SEO-friendly route for category retrieval.
   */
  getCategoryBySlug: async (req, res) => {
    try {
      const slug = req.params.slug;
      const category = await categoryHelper.getCategoryBySlug(slug);

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error('Error fetching category by slug:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching category' });
    }
  },

  /**
   * Get all categories with pagination, filtering, and hierarchical structure.
   * Allows for filtering by name and pagination for large datasets.
   */
  getAllCategories: async (req, res) => {
    try {
      const { query = '', page = 1, limit = 10 } = req.query;
      const categories = await categoryHelper.getAllCategories(query, page, limit);

      res.status(200).json({
        success: true,
        data: categories.categories,
        pagination: categories.pagination,
      });
    } catch (error) {
      console.error('Error fetching all categories:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching all categories' });
    }
  },

  /**
   * Get full category tree.
   * Returns the full hierarchical structure of categories and subcategories.
   */
  getCategoryTree: async (req, res) => {
    try {
      const categoryTree = await categoryHelper.getCategoryTree();
      res.status(200).json({
        success: true,
        data: categoryTree,
      });
    } catch (error) {
      console.error('Error fetching category tree:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching category tree' });
    }
  },

  /**
   * Update category by ID.
   * Validates and updates the category based on provided data.
   */
  updateCategoryById: async (req, res) => {
    try {
      const categoryId = req.params.id;
      const updateData = req.body;
      const updatedCategory = await categoryHelper.updateCategoryById(categoryId, updateData);

      // Emit event for category update
      const io = getSocketInstance();
      io.emit('category:updated', updatedCategory);

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

  /**
   * Delete category by ID.
   * Also deletes any associated child categories.
   */
  deleteCategoryById: async (req, res) => {
    try {
      const categoryId = req.params.id;
      const result = await categoryHelper.deleteCategoryById(categoryId);

      // Emit event for category deletion
      const io = getSocketInstance();
      io.emit('category:deleted', categoryId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Error deleting category:', error.message);
      res.status(500).json({ success: false, message: 'Error deleting category' });
    }
  },
};

module.exports = categoryController;
