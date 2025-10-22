const Analytics = require('../models/AnalyticsModel');
const { validationResult } = require('express-validator');
const cache = require('../utils/cache'); // Assuming cache uses Redis or similar
const logger = require('../utils/logger'); // Assuming logger like winston
const { getSocketInstance } = require('../socket');

const analyticsController = {
  // Track a page view with validation and caching
  trackPageView: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { page, userId } = req.body;

    if (!page || !userId) {
      return res.status(400).json({
        success: false,
        message: "Page and userId are required",
      });
    }

    try {
      const cacheKey = `pageView:${page}:${userId}`;
      const cachedData = await cache.get(cacheKey);

      // If data is not cached, save to DB and cache it
      if (!cachedData) {
        const analytics = new Analytics({ pageName: page, userId });
        await analytics.save();
        await cache.set(cacheKey, { page, userId }, 60 * 60); // Cache for 1 hour

        // Emit socket event for a new page view tracked
        const io = getSocketInstance();
        io.emit('analytics:pageViewTracked', { page, userId });
      }

      return res.status(200).json({
        success: true,
        message: "Page view tracked successfully",
      });
    } catch (error) {
      logger.error("Error tracking page view", { error });
      return res.status(500).json({
        success: false,
        message: "Error tracking page view",
      });
    }
  },

  // Generate analytics report
  // Generate analytics report with pagination
        generateReport: async (req, res) => {
          try {
            const cacheKey = 'analyticsReport';
            const cachedReport = await cache.get(cacheKey);

            if (cachedReport) {
              // Apply pagination even to cached data
              const page = parseInt(req.query.page) || 1;
              const limit = parseInt(req.query.limit) || 10;
              const start = (page - 1) * limit;
              const end = start + limit;

              return res.status(200).json({
                success: true,
                data: cachedReport.slice(start, end),
                pagination: {
                  currentPage: page,
                  totalPages: Math.ceil(cachedReport.length / limit),
                  totalItems: cachedReport.length,
                  limit,
                },
              });
            }

            const reportData = await Analytics.aggregate([
              { $group: { _id: { page: "$pageName" }, totalViews: { $sum: 1 }, uniqueUsers: { $addToSet: "$userId" } } },
              { $project: { _id: 1, totalViews: 1, uniqueUsers: { $size: "$uniqueUsers" } } },
              { $sort: { totalViews: -1 } },
            ]);

            await cache.set(cacheKey, reportData, 60 * 60);

            // Pagination
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const start = (page - 1) * limit;
            const end = start + limit;

            return res.status(200).json({
              success: true,
              data: reportData.slice(start, end),
              pagination: {
                currentPage: page,
                totalPages: Math.ceil(reportData.length / limit),
                totalItems: reportData.length,
                limit,
              },
            });
          } catch (error) {
            logger.error("Error generating report", { error });
            return res.status(500).json({
              success: false,
              message: "Error generating report",
            });
          }
        },

        // Cohort Analysis with pagination
        cohortAnalysis: async (req, res) => {
          try {
            const cohortData = await Analytics.aggregate([
              { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }, users: { $addToSet: "$userId" } } },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
            ]);

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const start = (page - 1) * limit;
            const end = start + limit;

            return res.status(200).json({
              success: true,
              data: cohortData.slice(start, end),
              pagination: {
                currentPage: page,
                totalPages: Math.ceil(cohortData.length / limit),
                totalItems: cohortData.length,
                limit,
              },
            });
          } catch (error) {
            logger.error("Error in cohort analysis", { error });
            return res.status(500).json({
              success: false,
              message: "Error in cohort analysis",
            });
          }
        },

        // User Segmentation with pagination
        userSegmentation: async (req, res) => {
          const { segmentCriteria } = req.body;

          if (!segmentCriteria) {
            return res.status(400).json({
              success: false,
              message: "Segment criteria is required",
            });
          }

          try {
            const segments = await Analytics.aggregate([
              { $match: segmentCriteria },
              { $group: { _id: { userId: "$userId" }, pagesViewed: { $addToSet: "$pageName" }, totalViews: { $sum: 1 } } },
            ]);

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const start = (page - 1) * limit;
            const end = start + limit;

            return res.status(200).json({
              success: true,
              data: segments.slice(start, end),
              pagination: {
                currentPage: page,
                totalPages: Math.ceil(segments.length / limit),
                totalItems: segments.length,
                limit,
              },
            });
          } catch (error) {
            logger.error("Error in user segmentation", { error });
            return res.status(500).json({
              success: false,
              message: "Error in user segmentation",
            });
          }
        },


  // Placeholder for future Predictive Analytics with ML integration
  predictiveAnalytics: async (req, res) => {
    try {
      // Placeholder logic for predictive analytics (e.g., using ML models)
      return res.status(200).json({
        success: true,
        message: "Predictive analytics logic executed successfully",
      });
    } catch (error) {
      logger.error("Error in predictive analytics", { error });
      return res.status(500).json({
        success: false,
        message: "Error in predictive analytics",
      });
    }
  },

  // Cohort Analysis
  cohortAnalysis: async (req, res) => {
    try {
      // Group users by the month and year they signed up
      const cohortData = await Analytics.aggregate([
        {
          $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            users: { $addToSet: "$userId" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }, // Sort cohorts by date
      ]);

      return res.status(200).json({
        success: true,
        data: cohortData,
      });
    } catch (error) {
      logger.error("Error in cohort analysis", { error });
      return res.status(500).json({
        success: false,
        message: "Error in cohort analysis",
      });
    }
  },

  // A/B Testing
  abTesting: async (req, res) => {
    const { experimentId, variant, userId } = req.body;

    if (!experimentId || !variant || !userId) {
      return res.status(400).json({
        success: false,
        message: "ExperimentId, variant, and userId are required",
      });
    }

    try {
      const abTestResult = await Analytics.create({
        experimentId,
        variant,
        userId,
      });

      // Emit socket event for A/B testing result recorded
      const io = getSocketInstance();
      io.emit('analytics:abTestRecorded', abTestResult);

      return res.status(200).json({
        success: true,
        message: "A/B testing result recorded successfully",
        abTestResult,
      });
    } catch (error) {
      logger.error("Error in A/B testing", { error });
      return res.status(500).json({
        success: false,
        message: "Error in A/B testing",
      });
    }
  },

  // User Segmentation
  userSegmentation: async (req, res) => {
    const { segmentCriteria } = req.body;

    if (!segmentCriteria) {
      return res.status(400).json({
        success: false,
        message: "Segment criteria is required",
      });
    }

    try {
      const segments = await Analytics.aggregate([
        {
          $match: segmentCriteria, // Apply segmentation criteria
        },
        {
          $group: {
            _id: { userId: "$userId" },
            pagesViewed: { $addToSet: "$pageName" },
            totalViews: { $sum: 1 },
          },
        },
      ]);

      return res.status(200).json({
        success: true,
        data: segments,
      });
    } catch (error) {
      logger.error("Error in user segmentation", { error });
      return res.status(500).json({
        success: false,
        message: "Error in user segmentation",
      });
    }
  },
};

module.exports = analyticsController;
