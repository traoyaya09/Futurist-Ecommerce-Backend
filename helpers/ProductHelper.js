const Product = require('../models/ProductModel');

// Get a product by ID with error handling
const getProductById = async (productId) => {
  try {
    // Validate ObjectId
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error('Invalid product ID format');
    }

    const product = await Product.findById(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    return product;
  } catch (error) {
    console.error('Error fetching product by ID:', error.message);
    throw new Error(error.message || 'Error fetching product by ID');
  }
};

// Get all products with optional pagination, sorting, and filtering
const getAllProducts = async ({ page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', filters = {} }) => {
  try {
    const skip = (page - 1) * limit;

    // Convert order to MongoDB sorting convention (-1 for descending, 1 for ascending)
    const sortOrder = order === 'desc' ? -1 : 1;
    const sort = { [sortBy]: sortOrder };

    // Apply filters (like price range, category, etc.)
    const query = { ...filters };

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalProducts = await Product.countDocuments(query);

    return {
      products,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('Error fetching all products:', error.message);
    throw new Error('Error fetching all products');
  }
};

// Search for products by name or description with pagination
const searchProducts = async ({ query, page = 1, limit = 10 }) => {
  try {
    const skip = (page - 1) * limit;
    const searchQuery = { 
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ] 
    };

    const products = await Product.find(searchQuery)
      .skip(skip)
      .limit(parseInt(limit));

    const totalProducts = await Product.countDocuments(searchQuery);

    return {
      products,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('Error searching products:', error.message);
    throw new Error('Error searching products');
  }
};

// Fetch products by category with optional pagination
const getProductsByCategory = async ({ categoryId, page = 1, limit = 10 }) => {
  try {
    const skip = (page - 1) * limit;

    const products = await Product.find({ category: categoryId })
      .skip(skip)
      .limit(parseInt(limit));

    const totalProducts = await Product.countDocuments({ category: categoryId });

    return {
      products,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('Error fetching products by category:', error.message);
    throw new Error('Error fetching products by category');
  }
};

module.exports = { 
  getProductById, 
  getAllProducts, 
  searchProducts, 
  getProductsByCategory 
};
