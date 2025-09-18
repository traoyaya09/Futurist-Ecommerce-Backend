const express = require("express");
const router = express.Router();
const contentController = require("../controllers/ContentController");

// Manage content (add, update, delete)
router.post("/manage", contentController.manageContent);

// Get content by filters
router.get("/", contentController.getContentByFilters);

// Get content by ID
router.get("/:contentId", contentController.getContentById);

module.exports = router;
