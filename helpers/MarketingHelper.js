const Marketing = require('../models/MarketingModel');
const mongoose = require('mongoose');

// Fetch all campaigns with pagination
const getAllCampaigns = async (page, limit) => {
    try {
        const skip = (page - 1) * limit;
        const campaigns = await Marketing.find().skip(skip).limit(limit);
        const total = await Marketing.countDocuments(); // Get total count for pagination
        return { campaigns, total };
    } catch (error) {
        console.error('Error fetching all campaigns:', error.message);
        throw new Error('Error fetching all campaigns');
    }
};

// Fetch a single campaign by ID with validation
const getCampaignById = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error('Invalid campaign ID format');
        }
        const campaign = await Marketing.findById(id);
        if (!campaign) {
            throw new Error('Campaign not found');
        }
        return campaign;
    } catch (error) {
        console.error(`Error fetching campaign by ID ${id}:`, error.message);
        throw new Error('Error fetching campaign by ID');
    }
};

// Create a new campaign
const createCampaign = async (campaignData) => {
    try {
        const newCampaign = new Marketing(campaignData);
        await newCampaign.save();
        return newCampaign;
    } catch (error) {
        console.error('Error creating campaign:', error.message);
        throw new Error('Error creating campaign');
    }
};

// Update an existing campaign by ID with validation
const updateCampaign = async (id, campaignData) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error('Invalid campaign ID format');
        }
        const updatedCampaign = await Marketing.findByIdAndUpdate(id, campaignData, { new: true });
        if (!updatedCampaign) {
            throw new Error('Campaign not found');
        }
        return updatedCampaign;
    } catch (error) {
        console.error(`Error updating campaign ${id}:`, error.message);
        throw new Error('Error updating campaign');
    }
};

// Delete a campaign by ID with validation
const deleteCampaign = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error('Invalid campaign ID format');
        }
        const deletedCampaign = await Marketing.findByIdAndDelete(id);
        if (!deletedCampaign) {
            throw new Error('Campaign not found');
        }
    } catch (error) {
        console.error(`Error deleting campaign ${id}:`, error.message);
        throw new Error('Error deleting campaign');
    }
};

module.exports = { getAllCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign };
