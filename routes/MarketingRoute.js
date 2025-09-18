const express = require('express');
const router = express.Router();
const { getAllCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign } = require('../controllers/MarketingController');
const { body, param } = require('express-validator');

// Define routes

// GET all campaigns with pagination
router.get('/', getAllCampaigns);

// GET a campaign by ID with ID validation
router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid campaign ID format')
], getCampaignById);

// POST create new campaign with validation
router.post('/', [
    body('campaignData.campaignName')
        .notEmpty().withMessage('Campaign name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
    body('campaignData.startDate')
        .isDate().withMessage('Start date must be a valid date')
        .custom((value, { req }) => {
            if (new Date(value) >= new Date(req.body.campaignData.endDate)) {
                throw new Error('Start date must be before end date');
            }
            return true;
        }),
    body('campaignData.endDate')
        .isDate().withMessage('End date must be a valid date'),
], createCampaign);

// PUT update campaign by ID with validation
router.put('/:id', [
    param('id').isMongoId().withMessage('Invalid campaign ID format'),
    body('campaignData.campaignName')
        .optional()
        .isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
    body('campaignData.startDate')
        .optional()
        .isDate().withMessage('Start date must be a valid date')
        .custom((value, { req }) => {
            if (value && new Date(value) >= new Date(req.body.campaignData.endDate)) {
                throw new Error('Start date must be before end date');
            }
            return true;
        }),
    body('campaignData.endDate')
        .optional()
        .isDate().withMessage('End date must be a valid date'),
], updateCampaign);

// DELETE a campaign by ID with ID validation
router.delete('/:id', [
    param('id').isMongoId().withMessage('Invalid campaign ID format'),
], deleteCampaign);

module.exports = router;
