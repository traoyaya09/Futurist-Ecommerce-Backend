const express = require('express');
const searchController = require('../controllers/SearchController'); // Import the search controller
const router = express.Router();

// Search route (Public Route)
router.get('/search/:query', searchController.search); // Search endpoint with query parameter

module.exports = router;