const { validationResult } = require('express-validator');
const {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign
} = require('../helpers/MarketingHelper');
const { getSocketInstance } = require('../socket');

const marketingController = {
  // Get all campaigns with pagination
  getAllCampaigns: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const campaigns = await getAllCampaigns(parseInt(page), parseInt(limit));

      if (!campaigns.length) {
        return res.status(404).json({ success: false, message: 'No campaigns found' });
      }

      res.status(200).json({ success: true, campaigns });
    } catch (error) {
      console.error('Error retrieving campaigns:', error.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve campaigns', error: error.message });
    }
  },

  // Get a single campaign by ID
  getCampaignById: async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await getCampaignById(id);

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      res.status(200).json({ success: true, campaign });
    } catch (error) {
      console.error(`Error retrieving campaign ${req.params.id}:`, error.message);
      res.status(500).json({ success: false, message: 'Failed to retrieve campaign', error: error.message });
    }
  },

  // Create a new campaign
  createCampaign: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { campaignData } = req.body;
      const newCampaign = await createCampaign(campaignData);

      // Emit event for campaign creation
      const io = getSocketInstance();
      io.emit('campaign:created', newCampaign);

      res.status(201).json({ success: true, message: 'Campaign created successfully', campaign: newCampaign });
    } catch (error) {
      console.error('Error creating campaign:', error.message);
      res.status(500).json({ success: false, message: 'Failed to create campaign', error: error.message });
    }
  },

  // Update an existing campaign by ID
  updateCampaign: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { campaignData } = req.body;
      const updatedCampaign = await updateCampaign(id, campaignData);

      if (!updatedCampaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      // Emit event for campaign update
      const io = getSocketInstance();
      io.emit('campaign:updated', updatedCampaign);

      res.status(200).json({ success: true, message: 'Campaign updated successfully', campaign: updatedCampaign });
    } catch (error) {
      console.error(`Error updating campaign ${req.params.id}:`, error.message);
      res.status(500).json({ success: false, message: 'Failed to update campaign', error: error.message });
    }
  },

  // Delete a campaign by ID
  deleteCampaign: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedCampaign = await deleteCampaign(id);

      if (!deletedCampaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      // Emit event for campaign deletion
      const io = getSocketInstance();
      io.emit('campaign:deleted', id);

      res.status(200).json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error(`Error deleting campaign ${req.params.id}:`, error.message);
      res.status(500).json({ success: false, message: 'Failed to delete campaign', error: error.message });
    }
  }
};

module.exports = marketingController;
