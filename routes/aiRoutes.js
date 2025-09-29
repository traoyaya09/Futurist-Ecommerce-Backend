// backend/routes/aiRoutes.js
const express = require("express");
const AIController = require("../controllers/AIController");
const { authenticate } = require("../middleware/authentication"); // ✅ destructure

const router = express.Router();

router.post("/query", authenticate, AIController.query); // ✅ use authenticate

module.exports = router;
