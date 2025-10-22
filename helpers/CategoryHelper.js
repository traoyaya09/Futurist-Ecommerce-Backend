const Category = require('../models/CategoryModel');

const categoryHelper = {
  /**
   * Creates a new category.
   * Handles hierarchical data if `parentCategory` is provided.
   */
  createCategory: async (categoryData) => {
    try {
      // Format data and save the category
      const newCategory = new Category(categoryData);
      await newCategory.save();
      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error.message);
      throw new Error('Error creating category');
    }
  },

  /**
   * Fetches a category by its ID.
   * Optionally populates subcategories and parentCategory.
   */
  getCategoryById: async (categoryId) => {
    try {
      const category = await Category.findById(categoryId)
        .populate('parentCategory', 'name slug')
        .populate('childrenCategories', 'name slug');

      if (!category) {
        throw new Error('Category not found');
      }

      return category;
    } catch (error) {
      console.error('Error fetching category by ID:', error.message);
      throw new Error('Error fetching category by ID');
    }
  },

  /**
   * Fetches a category by its slug.
   * Useful for SEO-friendly URL routing.
   */
  getCategoryBySlug: async (slug) => {
    try {
      const category = await Category.findOne({ slug })
        .populate('parentCategory', 'name slug')
        .populate('childrenCategories', 'name slug');

      if (!category) {
        throw new Error('Category not found');
      }

      return category;
    } catch (error) {
      console.error('Error fetching category by slug:', error.message);
      throw new Error('Error fetching category by slug');
    }
  },

  /**
   * Fetches all categories with optional pagination and hierarchical view.
   * Supports searching by category name.
   */
  getAllCategories: async (query = '', page = 1, limit = 10) => {
    try {
      const skip = (page - 1) * limit;
      const regexQuery = new RegExp(query, 'i');

      // Fetch categories with pagination and search
      const categories = await Category.find({ name: regexQuery, parentCategory: null })
        .skip(skip)
        .limit(limit)
        .populate('childrenCategories', 'name slug');

      const totalCategories = await Category.countDocuments({ name: regexQuery });

      return {
        categories,
        pagination: {
          totalItems: totalCategories,
          totalPages: Math.ceil(totalCategories / limit),
          currentPage: page,
        },
      };
    } catch (error) {
      console.error('Error fetching all categories:', error.message);
      throw new Error('Error fetching all categories');
    }
  },

  /**
   * Fetches the full hierarchical category tree, including all subcategories.
   */
  getCategoryTree: async () => {
    try {
      const categoryTree = await Category.getCategoryTree(); // Using the static method from the Category model
      return categoryTree;
    } catch (error) {
      console.error('Error fetching category tree:', error.message);
      throw new Error('Error fetching category tree');
    }
  },

  /**
   * Updates an existing category by its ID.
   * Can handle updates for parent and child categories.
   */
  updateCategoryById: async (categoryId, updateData) => {
    try {
      const updatedCategory = await Category.findByIdAndUpdate(categoryId, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedCategory) {
        throw new Error('Category not found');
      }

      return updatedCategory;
    } catch (error) {
      console.error('Error updating category:', error.message);
      throw new Error('Error updating category');
    }
  },

  /**
   * Deletes a category by its ID.
   * Ensures that child categories are also deleted, if required.
   */
  deleteCategoryById: async (categoryId) => {
    try {
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Delete the category and any associated child categories
      await Category.deleteOne({ _id: categoryId });
      await Category.deleteMany({ parentCategory: categoryId });

      return { message: 'Category and subcategories deleted successfully' };
    } catch (error) {
      console.error('Error deleting category:', error.message);
      throw new Error('Error deleting category');
    }
  },
};

module.exports = categoryHelper;
