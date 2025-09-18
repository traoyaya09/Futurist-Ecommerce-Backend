const Search = require('../models/SearchModel');  // Import the Search model

// A helper function to handle errors in async routes
const handleError = (res, error, message = 'Server error') => {
    console.error(error.message || error);
    res.status(500).json({ message });
};

const searchController = {
    // Search products, users, and inventory based on query
    search: async (req, res) => {
        try {
            const { query } = req.params;  // Extract query from request params
            if (!query) {
                return res.status(400).json({ message: 'Query parameter is required' });
            }

            // Perform the search using the Search model
            const results = await Search.search(query);

            // Respond with the search results
            res.status(200).json(results);  // Results contain products, users, and inventory

        } catch (error) {
            handleError(res, error, 'Error searching');
        }
    },
};

module.exports = searchController;
