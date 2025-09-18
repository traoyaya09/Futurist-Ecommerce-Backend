const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/AnalyticsController");
const { authenticate } = require("../middleware/authentication");
const { authorize } = require("../middleware/authorization");

// ✅ Track page view (Customer only)
router.post("/track-page-view", authenticate, authorize("Customer"), analyticsController.trackPageView);

// ✅ Generate analytics report (Admin only)
router.get("/generate-report", authenticate, authorize("Admin"), analyticsController.generateReport);

// ✅ Predictive analytics (Admin only)
router.get("/predictive-analytics", authenticate, authorize("Admin"), analyticsController.predictiveAnalytics);

// ✅ Cohort analysis (Admin only)
router.get("/cohort-analysis", authenticate, authorize("Admin"), analyticsController.cohortAnalysis);

// ✅ A/B Testing (Admin only)
router.post("/ab-testing", authenticate, authorize("Admin"), analyticsController.abTesting);

// ✅ User segmentation (Admin only)
router.post("/user-segmentation", authenticate, authorize("Admin"), analyticsController.userSegmentation);

// ✅ Default analytics report route
router.get("/", authenticate, authorize("Admin"), analyticsController.generateReport);

module.exports = router;
