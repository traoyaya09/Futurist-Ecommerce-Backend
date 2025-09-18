const mongoose = require('mongoose');
const Product = require('./ProductModel');  // Assuming you have a Product model
const User = require('./UserModel');  // Assuming you have a User model
const Inventory = require('./InventoryModel');  // Assuming you have an Inventory model

const SearchSchema = new mongoose.Schema({}, { timestamps: true });

// Search Functionality
SearchSchema.statics.search = async function(query) {
    try {
        // Create an object to store results
        const results = {
            products: [],
            users: [],
            inventory: []
        };

        // Search in Product model
        const productResults = await Product.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ]
        }).limit(10);  // Limit results for performance
        results.products = productResults;

        // Search in User model
        const userResults = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).limit(10);
        results.users = userResults;

        // Search in Inventory model
        const inventoryResults = await Inventory.find({
            $or: [
                { productName: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ]
        }).limit(10);
        results.inventory = inventoryResults;

        return results;
    } catch (error) {
        console.error('Error in search operation: ', error);
        throw new Error('Search failed');
    }
};

// Create Search Model
const Search = mongoose.model('Search', SearchSchema);
module.exports = Search;
