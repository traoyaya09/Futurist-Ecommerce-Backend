// controllers/productController.js
const Product = require('../models/ProductModel');
const mongoose = require('mongoose');
const { getSocketInstance } = require('../socket');
const { normalizeIncomingProduct } = require('../utils/adaptProduct');


// Helper to emit socket events
const emitProductEvent = (event, data) => {
  const io = getSocketInstance();
  io.emit(event, data);
};

// -------------------------
// PROGRAMMATIC HELPERS FOR AI SERVICE
// -------------------------
module.exports.searchProductsByQuery = async (query) => {
  const filter = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { brand: { $regex: query, $options: 'i' } },
    ],
  };
  const products = await Product.find(filter).limit(20);
  return products.map(Product.normalizeIncoming);
};

module.exports.getFeaturedProductsForAI = async () => {
  const products = await Product.find({ isFeatured: true }).limit(10);
  return products.map(Product.normalizeIncoming);
};

module.exports.getProductByIdForAI = async (id) => {
  const product = await Product.findById(id);
  if (!product) return null;
  return Product.normalizeIncoming(product);
};


const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { search, category, isFeatured } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (isFeatured) filter.isFeatured = isFeatured === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(Product.normalizeIncoming),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch products: ' + error.message });
  }
};


// -------------------------
// GET PRODUCT BY ID
// -------------------------
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ status: 'error', message: 'Product not found' });

    res.status(200).json({
      status: 'success',
      data: normalizeIncomingProduct(product),
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError)
      return res.status(400).json({ status: 'error', message: 'Invalid product ID format' });
    res.status(500).json({ status: 'error', message: 'Failed to fetch product: ' + error.message });
  }
};

// -------------------------
// CREATE PRODUCT
// -------------------------
const createProduct = async (req, res) => {
  try {
    const normalizedData = normalizeIncomingProduct(req.body);
    const product = new Product(normalizedData);
    const newProduct = await product.save();

    emitProductEvent('product:created', normalizeIncomingProduct(newProduct));

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: normalizeIncomingProduct(newProduct),
    });
  } catch (error) {
    if (error.name === 'ValidationError')
      return res.status(400).json({ status: 'error', message: 'Validation error: ' + error.message });
    res.status(500).json({ status: 'error', message: 'Failed to create product: ' + error.message });
  }
};

// -------------------------
// UPDATE PRODUCT BY ID
// -------------------------
const updateProductById = async (req, res) => {
  try {
    const normalizedData = normalizeIncomingProduct(req.body);
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, normalizedData, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct)
      return res.status(404).json({ status: 'error', message: 'Product not found' });

    emitProductEvent('product:updated', normalizeIncomingProduct(updatedProduct));

    res.status(200).json({
      status: 'success',
      message: 'Product updated successfully',
      data: normalizeIncomingProduct(updatedProduct),
    });
  } catch (error) {
    if (error.name === 'ValidationError')
      return res.status(400).json({ status: 'error', message: 'Validation error: ' + error.message });
    if (error instanceof mongoose.Error.CastError)
      return res.status(400).json({ status: 'error', message: 'Invalid product ID format' });
    res.status(500).json({ status: 'error', message: 'Failed to update product: ' + error.message });
  }
};

// -------------------------
// DELETE PRODUCT BY ID
// -------------------------
const deleteProductById = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res.status(404).json({ status: 'error', message: 'Product not found' });

    emitProductEvent('product:deleted', req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
      data: normalizeIncomingProduct(deletedProduct),
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError)
      return res.status(400).json({ status: 'error', message: 'Invalid product ID format' });
    res.status(500).json({ status: 'error', message: 'Failed to delete product: ' + error.message });
  }
};

// -------------------------
// GET PRODUCTS BY CATEGORY
// -------------------------
const getProductsByCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { category: req.params.category };
    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    if (products.length === 0)
      return res.status(404).json({ status: 'error', message: 'No products found in this category' });

    res.status(200).json({
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch products by category: ' + error.message });
  }
};

// -------------------------
// SEARCH PRODUCTS
// -------------------------
const searchProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { query } = req.query;

    if (!query)
      return res.status(400).json({ status: 'error', message: 'Search query is required' });

    const filter = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
      ],
    };

    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    if (products.length === 0)
      return res.status(404).json({ status: 'error', message: 'No products found matching the search criteria' });

    res.status(200).json({
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to search products: ' + error.message });
  }
};

// -------------------------
// GET FEATURED PRODUCTS
// -------------------------
const getFeaturedProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { isFeatured: true };
    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    if (products.length === 0)
      return res.status(404).json({ status: 'error', message: 'No featured products found' });

    res.status(200).json({
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch featured products: ' + error.message });
  }
};

// -------------------------
// Export Controller
// -------------------------
module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
  getProductsByCategory,
  searchProducts,
  getFeaturedProducts,
};
