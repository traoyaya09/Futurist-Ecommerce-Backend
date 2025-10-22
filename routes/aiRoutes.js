// backend/routes/aiRoutes.js
const express = require("express");
const AIController = require("../controllers/AIController");
const { authenticate } = require("../middleware/authentication"); // ✅ ensures user is authenticated

const router = express.Router();

// POST /api/ai/query
// Handles user AI queries with full orchestration
router.post("/query", authenticate, AIController.query);

module.exports = router;
