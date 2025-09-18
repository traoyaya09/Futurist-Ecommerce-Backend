const Brand = require('../models/BrandModel');
const { validationResult } = require('express-validator'); // For request validation
const { getSocketInstance } = require('../socket');

const brandController = {
  // Get all brands with pagination and filtering
  getAllBrands: async (req, res) => {
    try {
      const { page = 1, limit = 10, name } = req.query;

      // Build the query object
      let query = {};
      if (name) {
        query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
      }

      // Fetch brands with pagination and optional filtering
      const brands = await Brand.find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .exec();

      const total = await Brand.countDocuments(query); // Total brands count

      res.status(200).json({
        success: true,
        data: brands,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          totalItems: total,
        },
      });
    } catch (error) {
      console.error('Error fetching brands:', error.message);
      res.status(500).json({ success: false, message: 'Error fetching brands' });
    }
  },

  // Get a single brand by ID with error handling
  getBrandById: async (req, res) => {
    try {
      const brandId = req.params.id;
      const brand = await Brand.findById(brandId);

      if (!brand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      res.status(200).json({ success: true, data: brand });
    } catch (error) {
      console.error(`Error fetching brand with ID ${req.params.id}:`, error.message);
      res.status(500).json({ success: false, message: 'Error fetching brand' });
    }
  },

  // Create a new brand with validation and error handling
  createBrand: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const newBrand = new Brand(req.body);
      const savedBrand = await newBrand.save();

      // Emit socket event for new brand creation
      const io = getSocketInstance();
      io.emit('brand:created', savedBrand);

      res.status(201).json({
        success: true,
        message: 'Brand created successfully',
        data: savedBrand,
      });
    } catch (error) {
      console.error('Error creating brand:', error.message);
      res.status(500).json({ success: false, message: 'Error creating brand' });
    }
  },

  // Update a brand by ID with optimistic concurrency control
  updateBrand: async (req, res) => {
    try {
      const brandId = req.params.id;
      const updatedBrand = await Brand.findByIdAndUpdate(
        brandId,
        req.body,
        { new: true, runValidators: true }
      );

      if (!updatedBrand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      // Emit socket event for brand update
      const io = getSocketInstance();
      io.emit('brand:updated', updatedBrand);

      res.status(200).json({
        success: true,
        message: 'Brand updated successfully',
        data: updatedBrand,
      });
    } catch (error) {
      console.error(`Error updating brand with ID ${req.params.id}:`, error.message);
      res.status(500).json({ success: false, message: 'Error updating brand' });
    }
  },

  // Delete a brand by ID with validation and error handling
  deleteBrand: async (req, res) => {
    try {
      const brandId = req.params.id;
      const deletedBrand = await Brand.findByIdAndDelete(brandId);

      if (!deletedBrand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      // Emit socket event for brand deletion
      const io = getSocketInstance();
      io.emit('brand:deleted', brandId);

      res.status(200).json({
        success: true,
        message: 'Brand deleted successfully',
      });
    } catch (error) {
      console.error(`Error deleting brand with ID ${req.params.id}:`, error.message);
      res.status(500).json({ success: false, message: 'Error deleting brand' });
    }
  },
};

module.exports = brandController;
