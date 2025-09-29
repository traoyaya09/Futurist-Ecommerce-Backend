const Brand = require('../models/BrandModel');
const { validationResult } = require('express-validator');
const { getSocketInstance } = require('../socket');

// Helper for pagination and filtering
const getPaginatedBrands = async (req, res, filter = {}, selectFields = 'name createdAt') => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const brands = await Brand.find(filter)
      .skip(skip)
      .limit(limit)
      .select(selectFields);

    const total = await Brand.countDocuments(filter);

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      data: brands,
    });
  } catch (error) {
    console.error('Error fetching brands:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching brands' });
  }
};

const brandController = {
  // Get all brands with pagination and optional search filter
  getAllBrands: async (req, res) => {
    const { name } = req.query;
    const filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };

    await getPaginatedBrands(req, res, filter);
  },

  // Get a single brand by ID
  getBrandById: async (req, res) => {
    try {
      const brand = await Brand.findById(req.params.id);
      if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });

      res.status(200).json({ success: true, data: brand });
    } catch (error) {
      console.error(`Error fetching brand with ID ${req.params.id}:`, error.message);
      if (error instanceof require('mongoose').Error.CastError) {
        return res.status(400).json({ success: false, message: 'Invalid brand ID format' });
      }
      res.status(500).json({ success: false, message: 'Error fetching brand' });
    }
  },

  // Create a new brand
  createBrand: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const newBrand = new Brand(req.body);
      const savedBrand = await newBrand.save();

      getSocketInstance().emit('brand:created', savedBrand);

      res.status(201).json({ success: true, message: 'Brand created successfully', data: savedBrand });
    } catch (error) {
      console.error('Error creating brand:', error.message);
      res.status(500).json({ success: false, message: 'Error creating brand' });
    }
  },

  // Update a brand by ID
  updateBrand: async (req, res) => {
    try {
      const updatedBrand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!updatedBrand) return res.status(404).json({ success: false, message: 'Brand not found' });

      getSocketInstance().emit('brand:updated', updatedBrand);

      res.status(200).json({ success: true, message: 'Brand updated successfully', data: updatedBrand });
    } catch (error) {
      console.error(`Error updating brand with ID ${req.params.id}:`, error.message);
      if (error instanceof require('mongoose').Error.CastError) {
        return res.status(400).json({ success: false, message: 'Invalid brand ID format' });
      }
      res.status(500).json({ success: false, message: 'Error updating brand' });
    }
  },

  // Delete a brand by ID
  deleteBrand: async (req, res) => {
    try {
      const deletedBrand = await Brand.findByIdAndDelete(req.params.id);
      if (!deletedBrand) return res.status(404).json({ success: false, message: 'Brand not found' });

      getSocketInstance().emit('brand:deleted', req.params.id);

      res.status(200).json({ success: true, message: 'Brand deleted successfully' });
    } catch (error) {
      console.error(`Error deleting brand with ID ${req.params.id}:`, error.message);
      if (error instanceof require('mongoose').Error.CastError) {
        return res.status(400).json({ success: false, message: 'Invalid brand ID format' });
      }
      res.status(500).json({ success: false, message: 'Error deleting brand' });
    }
  },
};

module.exports = brandController;
