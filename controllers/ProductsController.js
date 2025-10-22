// controllers/productController.js
const Product = require('../models/ProductModel');
const mongoose = require('mongoose');
const axios = require('axios');
const { getSocketInstance } = require('../socket');
const { normalizeIncomingProduct } = require('../utils/adaptProduct');
const NodeCache = require('node-cache');
const productsCache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // cache for 1 min

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// -------------------------
// Helper: Emit socket events
// -------------------------
const emitProductEvent = (event, data) => {
  const io = getSocketInstance();
  io.emit(event, data);
};

// -------------------------
// Helper: Map raw recommendations to consistent { productId: [ { product, score } ] }
// -------------------------
const mapRecommendations = (recommendationsRaw) => {
  const recommendations = {};
  (recommendationsRaw || []).forEach(r => {
    recommendations[r.productId.toString()] = r.recommendations || [];
  });
  return recommendations;
};

// -------------------------
// Log single interaction
// -------------------------
const logInteraction = async ({ userId, productId, action }) => {
  try {
    if (!userId || !productId || !action) return;
    await axios.post(`${FASTAPI_URL}/interactions`, { userId, productId, action });
  } catch (error) {
    console.warn(`[Interaction] Failed to log ${action} for product ${productId}:`, error.message);
  }
};

// -------------------------
// Log product click / purchase
// -------------------------
const handleProductClick = async (productId, userId) => {
  if (!productId || !userId) return;
  await logInteraction({ userId, productId, action: 'click' });
};

const handleProductPurchase = async (productId, userId) => {
  if (!productId || !userId) return;
  await logInteraction({ userId, productId, action: 'purchase' });
};

// -------------------------
// Fetch recommendations in batch
// -------------------------
const fetchRecommendationsBatch = async ({ userId, productNames }) => {
  if (!userId || !productNames || productNames.length === 0) return {};

  try {
    const query = productNames.join(" | ");
    const res = await axios.post(`${FASTAPI_URL}/recommendations`, { userId, query, limit: 10 });
    return mapRecommendations(res.data.data); // Use centralized helper
  } catch (error) {
    console.warn('[Recommendation] Batch fetch failed:', error.message);
    return {};
  }
};

// -------------------------
// Handle bulk interactions & recommendations
// -------------------------
const handleBulkInteractionsAndRecommendations = async (products, userId, action = 'view') => {
  if (!products || products.length === 0) return [];

  // Log interactions in parallel
  await Promise.all(products.map(p => logInteraction({ userId, productId: p._id, action })));

  // Fetch recommendations
  const productNames = products.map(p => p.name);
  const recMap = await fetchRecommendationsBatch({ userId, productNames });

  // Map back to each product
  return products.map(p => ({
    productId: p._id.toString(),
    recommendations: recMap[p._id.toString()] || [],
  }));
};

// -------------------------
// PROGRAMMATIC HELPERS FOR AI SERVICE
// -------------------------
const searchProductsByQuery = async (query) => {
  const filter = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { brand: { $regex: query, $options: 'i' } },
    ],
  };
  const products = await Product.find(filter).limit(20);
  return products.map(normalizeIncomingProduct);
};

const getFeaturedProductsForAI = async () => {
  const products = await Product.find({ isFeatured: true }).limit(10);
  return products.map(normalizeIncomingProduct);
};

const getProductByIdForAI = async (id) => {
  const product = await Product.findById(id);
  if (!product) return null;
  return normalizeIncomingProduct(product);
};

const getCatalogSummaryForAI = async () => {
  const total = await Product.countDocuments();
  const categories = await Product.distinct('category');
  return `We have ${total} products across ${categories.length} categories.`;
};

// -------------------------
// GET ALL PRODUCTS
// -------------------------

const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, category, subCategory, isFeatured, userId } = req.query;

    // -------------------------
    // Generate cache key
    // -------------------------
    const cacheKey = `products:${page}:${limit}:${search || ''}:${category || 'All'}:${subCategory || ''}:${isFeatured || ''}:${userId || ''}`;
    const cachedData = productsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ ...cachedData, source: 'cache' });
    }

    // -------------------------
    // Build filter
    // -------------------------
    const filter = {};

    if (category && category !== "All") filter.category = category;
    if (subCategory && subCategory.trim() !== "") filter.subCategory = subCategory;
    if (isFeatured) filter.isFeatured = isFeatured === "true";

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    // -------------------------
    // Fetch products
    // -------------------------
    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    // Add recommendations
    const recommendationsRaw = await handleBulkInteractionsAndRecommendations(products, userId, "view");
    const recommendations = mapRecommendations(recommendationsRaw);

    // -------------------------
    // Response object
    // -------------------------
    const response = {
      status: "success",
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
      recommendations,
    };

    // -------------------------
    // Cache response
    // -------------------------
    productsCache.set(cacheKey, response);

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ status: "error", message: "Failed to fetch products: " + error.message });
  }
};


// -------------------------
// GET PRODUCT BY ID
// -------------------------
const getProductById = async (req, res) => {
  try {
    const { userId } = req.query;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

    const recommendationsRaw = await handleBulkInteractionsAndRecommendations([product], userId, 'view');
    const recommendations = mapRecommendations(recommendationsRaw);

    await handleProductClick(product._id, userId);

    res.status(200).json({
      status: 'success',
      data: normalizeIncomingProduct(product),
      recommendations: recommendations[product._id.toString()] || [],
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError)
      return res.status(400).json({ status: 'error', message: 'Invalid product ID format' });
    res.status(500).json({ status: 'error', message: 'Failed to fetch product: ' + error.message });
  }
};

// -------------------------
// CREATE / UPDATE / DELETE
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

const updateProductById = async (req, res) => {
  try {
    const normalizedData = normalizeIncomingProduct(req.body);
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, normalizedData, { new: true, runValidators: true });
    if (!updatedProduct) return res.status(404).json({ status: 'error', message: 'Product not found' });

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

const deleteProductById = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ status: 'error', message: 'Product not found' });

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
// GET PRODUCTS BY CATEGORY (CACHED)
// -------------------------
const getProductsByCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { userId } = req.query;
    const category = req.params.category;

    const cacheKey = `products:category:${category}:${page}:${limit}:${userId || ''}`;
    const cachedData = productsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ ...cachedData, source: 'cache' });
    }

    const filter = { category };
    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    if (products.length === 0)
      return res.status(404).json({ status: 'error', message: 'No products found in this category' });

    const recommendationsRaw = await handleBulkInteractionsAndRecommendations(products, userId, 'view');
    const recommendations = mapRecommendations(recommendationsRaw);

    const response = {
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
      recommendations,
    };

    productsCache.set(cacheKey, response);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch products by category: ' + error.message });
  }
};

// -------------------------
// SEARCH PRODUCTS (CACHED)
// -------------------------
const searchProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { query, userId } = req.query;

    if (!query) return res.status(400).json({ status: 'error', message: 'Search query is required' });

    const cacheKey = `products:search:${query}:${page}:${limit}:${userId || ''}`;
    const cachedData = productsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ ...cachedData, source: 'cache' });
    }

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

    const recommendationsRaw = await handleBulkInteractionsAndRecommendations(products, userId, 'view');
    const recommendations = mapRecommendations(recommendationsRaw);

    const response = {
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
      recommendations,
    };

    productsCache.set(cacheKey, response);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to search products: ' + error.message });
  }
};


// -------------------------
// GET DISTINCT CATEGORIES + SUBCATEGORIES FROM PRODUCTS (CACHED)
// -------------------------

let cachedCategories = null;
let cacheTimestamp = null;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const getCategoriesFromProducts = async (req, res) => {
  try {
    const now = Date.now();

    // Check cache validity
    if (cachedCategories && cacheTimestamp && now - cacheTimestamp < CACHE_TTL) {
      return res.status(200).json({
        status: 'success',
        source: 'cache',
        totalCategories: cachedCategories.length,
        data: cachedCategories,
      });
    }

    // Fetch unique categories
    const categories = await Product.distinct('category');

    // For each category, get unique subcategories
    const categoriesWithSub = await Promise.all(
      categories.map(async (cat) => {
        const subCategories = await Product.distinct('subCategory', { category: cat });
        return {
          category: cat,
          subCategories: subCategories.filter(sub => sub && sub.trim() !== ''),
        };
      })
    );

    // Update cache
    cachedCategories = categoriesWithSub;
    cacheTimestamp = now;

    res.status(200).json({
      status: 'success',
      source: 'database',
      totalCategories: categories.length,
      data: categoriesWithSub,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch categories: ' + error.message,
    });
  }
};


// -------------------------
// GET FEATURED PRODUCTS (CACHED)
// -------------------------
const getFeaturedProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { userId } = req.query;

    const cacheKey = `products:featured:${page}:${limit}:${userId || ''}`;
    const cachedData = productsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({ ...cachedData, source: 'cache' });
    }

    const filter = { isFeatured: true };
    const products = await Product.find(filter).skip(skip).limit(limit);
    const total = await Product.countDocuments(filter);

    if (products.length === 0)
      return res.status(404).json({ status: 'error', message: 'No featured products found' });

    const recommendationsRaw = await handleBulkInteractionsAndRecommendations(products, userId, 'view');
    const recommendations = mapRecommendations(recommendationsRaw);

    const response = {
      status: 'success',
      page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      data: products.map(normalizeIncomingProduct),
      recommendations,
    };

    productsCache.set(cacheKey, response);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch featured products: ' + error.message });
  }
};
// -------------------------
// PURCHASE PRODUCT
// -------------------------
const purchaseProduct = async (req, res) => {
  try {
    const { userId } = req.body;
    const productId = req.params.id;

    if (!userId || !productId)
      return res.status(400).json({ status: 'error', message: 'Missing userId or productId' });

    await handleProductPurchase(productId, userId);

    res.status(200).json({
      status: 'success',
      message: 'Purchase logged successfully',
      productId,
      userId
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to log purchase: ' + error.message });
  }
};

// -------------------------
// EXPORT CONTROLLER
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
  purchaseProduct,
  searchProductsByQuery,
  getFeaturedProductsForAI,
  getProductByIdForAI,
  getCatalogSummaryForAI,
  getCategoriesFromProducts,
};
