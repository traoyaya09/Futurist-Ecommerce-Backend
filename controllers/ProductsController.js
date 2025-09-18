const Product = require('../models/ProductModel');
const mongoose = require('mongoose');
const { getSocketInstance } = require('../socket');

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products: ' + error.message,
    });
  }
};

// Get a product by ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Invalid product ID format' });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch product: ' + error.message,
    });
  }
};

// Create a new product
const createProduct = async (req, res) => {
  const { name, description, price, category, imageUrl, featured } = req.body;

  // Create product with data
  const product = new Product({
    name,
    description,
    price,
    category,
    imageUrl,
    featured,
  });

  try {
    const newProduct = await product.save();

    // Emit socket event for product creation
    const io = getSocketInstance();
    io.emit('product:created', newProduct);

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: newProduct,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error: ' + error.message,
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to create product: ' + error.message,
    });
  }
};

// Update a product by ID
const updateProductById = async (req, res) => {
  const { name, description, price, category, imageUrl, featured } = req.body;

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, category, imageUrl, featured },
      { new: true, runValidators: true } // Run validators on update
    );
    if (!updatedProduct)
      return res
        .status(404)
        .json({ status: 'error', message: 'Product not found' });

    // Emit socket event for product update
    const io = getSocketInstance();
    io.emit('product:updated', updatedProduct);

    res.status(200).json({
      status: 'success',
      message: 'Product updated successfully',
      data: updatedProduct,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error: ' + error.message,
      });
    }
    if (error instanceof mongoose.Error.CastError) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Invalid product ID format' });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to update product: ' + error.message,
    });
  }
};

// Delete a product by ID
const deleteProductById = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res
        .status(404)
        .json({ status: 'error', message: 'Product not found' });

    // Emit socket event for product deletion
    const io = getSocketInstance();
    io.emit('product:deleted', req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
      data: deletedProduct,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Invalid product ID format' });
    }
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete product: ' + error.message,
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const products = await Product.find({ category });
    if (products.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No products found in this category',
      });
    }
    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products by category: ' + error.message,
    });
  }
};

// Search for products by name or description
const searchProducts = async (req, res) => {
  const { query } = req.query; // Assuming search term is passed via query string
  try {
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } }, // Case-insensitive search
        { description: { $regex: query, $options: 'i' } },
      ],
    });

    if (products.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No products found matching the search criteria',
      });
    }
    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to search products: ' + error.message,
    });
  }
};

// Get featured products
const getFeaturedProducts = async (req, res) => {
  try {
    const featuredProducts = await Product.find({ featured: true });
    if (featuredProducts.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No featured products found',
      });
    }
    res.status(200).json({
      status: 'success',
      data: featuredProducts,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch featured products: ' + error.message,
    });
  }
};

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
