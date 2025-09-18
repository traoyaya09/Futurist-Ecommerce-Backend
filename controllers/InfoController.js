const Info = require('../models/InfoModel');
const { getSocketInstance } = require('../socket');

const infoController = {
  // Fetch all info with pagination, filtering, and sorting
  getAllInfo: async (req, res) => {
    try {
      const { title, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

      // Build filter object
      const filter = {};
      if (title) {
        filter.title = { $regex: title, $options: 'i' }; // Case-insensitive search by title
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Pagination logic
      const infoData = await Info.find(filter)
        .sort(sort)
        .limit(parseInt(limit))
        .skip((page - 1) * limit)
        .exec();

      const totalInfos = await Info.countDocuments(filter);
      const totalPages = Math.ceil(totalInfos / limit);

      res.status(200).json({
        success: true,
        totalPages,
        currentPage: Number(page),
        totalInfos,
        infoData,
      });
    } catch (error) {
      console.error(`Error fetching all info: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  // Get a single info by its ID
  getInfoById: async (req, res) => {
    try {
      const { id } = req.params;
      const info = await Info.findById(id);
      if (!info) {
        return res.status(404).json({ success: false, message: 'Info not found' });
      }
      res.status(200).json({ success: true, data: info });
    } catch (error) {
      console.error(`Error fetching info by ID: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  // Create a new info entry
  createInfo: async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Title and content are required' });
      }

      const newInfo = new Info({ title: title.trim(), content: content.trim() });
      const savedInfo = await newInfo.save();

      // Emit socket event for new info creation
      const io = getSocketInstance();
      io.emit('info:created', savedInfo);

      res.status(201).json({ success: true, message: 'Info created successfully', data: savedInfo });
    } catch (error) {
      console.error(`Error creating info: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  // Update an existing info entry
  updateInfo: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content } = req.body;

      if (!id || (!title && !content)) {
        return res.status(400).json({ success: false, message: 'ID, title, or content is required' });
      }

      const updateFields = {};
      if (title) updateFields.title = title.trim();
      if (content) updateFields.content = content.trim();

      const updatedInfo = await Info.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
      if (!updatedInfo) {
        return res.status(404).json({ success: false, message: 'Info not found' });
      }

      // Emit socket event for info update
      const io = getSocketInstance();
      io.emit('info:updated', updatedInfo);

      res.status(200).json({ success: true, message: 'Info updated successfully', data: updatedInfo });
    } catch (error) {
      console.error(`Error updating info: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  // Delete an info entry
  deleteInfo: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID parameter is required' });
      }

      const deletedInfo = await Info.findByIdAndDelete(id);
      if (!deletedInfo) {
        return res.status(404).json({ success: false, message: 'Info not found' });
      }

      // Emit socket event for info deletion
      const io = getSocketInstance();
      io.emit('info:deleted', id);

      res.status(200).json({ success: true, message: 'Info deleted successfully' });
    } catch (error) {
      console.error(`Error deleting info: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
};

module.exports = infoController;
