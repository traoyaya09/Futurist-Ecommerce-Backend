const Info = require('../models/InfoModel');

const infoHelper = {
  // Create a new Info entry with validation
  createInfo: async (infoData) => {
    try {
      const newInfo = new Info(infoData);
      await newInfo.save();
      return newInfo;
    } catch (error) {
      console.error('Error creating info:', error.message);
      throw new Error('Failed to create info entry');
    }
  },

  // Fetch Info by ID with error handling
  getInfoById: async (infoId) => {
    try {
      const info = await Info.findById(infoId);
      if (!info) {
        throw new Error('Info not found');
      }
      return info;
    } catch (error) {
      console.error('Error fetching info by ID:', error.message);
      throw new Error('Failed to fetch info by ID');
    }
  },

  // Fetch all Info entries with pagination and filtering
  getAllInfo: async (query = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') => {
    try {
      const filter = {};
      if (query.title) {
        filter.title = { $regex: query.title, $options: 'i' }; // Case-insensitive search
      }

      const skip = (page - 1) * limit;
      const sortOrderValue = sortOrder === 'desc' ? -1 : 1;

      const infoList = await Info.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ [sortBy]: sortOrderValue })
        .exec();

      const totalItems = await Info.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limit);

      return {
        success: true,
        data: infoList,
        pagination: {
          totalPages,
          currentPage: page,
          totalItems,
        },
      };
    } catch (error) {
      console.error('Error fetching all info:', error.message);
      throw new Error('Failed to fetch info list');
    }
  },

  // Update Info by ID
  updateInfoById: async (infoId, updateData) => {
    try {
      const updatedInfo = await Info.findByIdAndUpdate(infoId, updateData, { new: true, runValidators: true });
      if (!updatedInfo) {
        throw new Error('Info not found');
      }
      return updatedInfo;
    } catch (error) {
      console.error('Error updating info by ID:', error.message);
      throw new Error('Failed to update info');
    }
  },

  // Delete Info by ID
  deleteInfoById: async (infoId) => {
    try {
      const deletedInfo = await Info.findByIdAndDelete(infoId);
      if (!deletedInfo) {
        throw new Error('Info not found');
      }
      return deletedInfo;
    } catch (error) {
      console.error('Error deleting info by ID:', error.message);
      throw new Error('Failed to delete info');
    }
  },

  // Search Info by keyword in title and content
  searchInfo: async (keyword, page = 1, limit = 10) => {
    try {
      const filter = { $text: { $search: keyword } }; // Full-text search
      const skip = (page - 1) * limit;
      
      const infoList = await Info.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();

      const totalItems = await Info.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limit);

      return {
        success: true,
        data: infoList,
        pagination: {
          totalPages,
          currentPage: page,
          totalItems,
        },
      };
    } catch (error) {
      console.error('Error searching info:', error.message);
      throw new Error('Failed to search info');
    }
  },
};

module.exports = infoHelper;
