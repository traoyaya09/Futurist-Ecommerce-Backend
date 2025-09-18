const Product = require('../models/ProductModel');
const User = require('../models/UserModel');
const Inventory = require('../models/InventoryModel');

// Helper function to search products by query
const searchProducts = async (query) => {
    try {
        return await Product.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },  // Search by product name (case-insensitive)
                { description: { $regex: query, $options: 'i' } }  // Search by product description
            ]
        }).exec();
    } catch (error) {
        console.error('Error searching products:', error);
        throw new Error('Error searching products');
    }
};

// Helper function to search users by query
const searchUsers = async (query) => {
    try {
        return await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },  // Search by username (case-insensitive)
                { email: { $regex: query, $options: 'i' } }  // Search by user email
            ]
        }).exec();
    } catch (error) {
        console.error('Error searching users:', error);
        throw new Error('Error searching users');
    }
};

// Helper function to search inventory by query
const searchInventory = async (query) => {
    try {
        return await Inventory.find({
            $or: [
                { productName: { $regex: query, $options: 'i' } },  // Search by product name in inventory
                { category: { $regex: query, $options: 'i' } }  // Search by category in inventory
            ]
        }).exec();
    } catch (error) {
        console.error('Error searching inventory:', error);
        throw new Error('Error searching inventory');
    }
};

// Combine all search functions into one to return the complete results
const searchHelper = {
    search: async (query) => {
        try {
            // Perform individual searches across products, users, and inventory
            const products = await searchProducts(query);
            const users = await searchUsers(query);
            const inventory = await searchInventory(query);

            // Return all results as a single object
            return {
                products,
                users,
                inventory
            };
        } catch (error) {
            console.error('Error performing search:', error);
            throw new Error('Error performing search');
        }
    }
};

module.exports = searchHelper;
