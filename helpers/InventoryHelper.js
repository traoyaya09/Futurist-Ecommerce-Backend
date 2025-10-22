const Inventory = require('../models/InventoryModel');

// Fetch all inventory items with optional filtering, sorting, and pagination
const getAllInventory = async (filter = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') => {
    try {
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const inventory = await Inventory.find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit);
        const total = await Inventory.countDocuments(filter);
        const totalPages = Math.ceil(total / limit); // Calculate total pages

        return { inventory, total, totalPages, page, limit }; // Return totalPages in the response
    } catch (error) {
        console.error(error);
        throw new Error('Error fetching inventory');
    }
};


// Fetch inventory by ID with validation
const getInventoryById = async (id) => {
    try {
        if (!id) {
            throw new Error('ID parameter is required');
        }

        const inventory = await Inventory.findById(id);
        if (!inventory) {
            throw new Error('Inventory not found');
        }

        return inventory;
    } catch (error) {
        console.error(error);
        throw new Error(`Error fetching inventory by ID: ${error.message}`);
    }
};

// Adjust inventory with validation and stock history update
// Adjust inventory with validation and stock history update
const adjustInventory = async (id, adjustmentType, quantity, userId) => {
    try {
        if (!id || !adjustmentType || typeof quantity !== 'number') {
            throw new Error('Invalid input: ID, adjustment type, and quantity are required');
        }

        const inventory = await Inventory.findById(id);
        if (!inventory) {
            throw new Error('Inventory not found');
        }

        let action;
        if (adjustmentType === 'increase') {
            inventory.quantity += quantity;
            action = 'increase';
        } else if (adjustmentType === 'decrease') {
            if (inventory.quantity < quantity) {
                throw new Error('Not enough stock to decrease');
            }
            inventory.quantity -= quantity;
            action = 'decrease';
        } else {
            throw new Error('Invalid adjustment type');
        }

        // Update stock status after adjustment
        if (inventory.quantity <= 0) {
            inventory.stockStatus = 'out-of-stock';
        } else if (inventory.quantity <= inventory.lowStockThreshold) {
            inventory.stockStatus = 'low-stock';
        } else {
            inventory.stockStatus = 'in-stock';
        }

        // Push the adjustment to the stock history
        inventory.stockHistory.push({
            action,
            quantity,
            adjustedBy: userId
        });

        await inventory.save();
        return inventory;
    } catch (error) {
        console.error(error);
        throw new Error(`Error adjusting inventory: ${error.message}`);
    }
};

const Joi = require('joi');

// Define schema for inventory creation
const createInventorySchema = Joi.object({
    name: Joi.string().required(),
    quantity: Joi.number().integer().min(0).required(),
    sku: Joi.string().required(),
    location: Joi.string().default('Main Warehouse')
});

// Create new inventory item with validation
const createInventory = async (name, quantity, sku, location = 'Main Warehouse') => {
    try {
        // Validate input using Joi
        const { error } = createInventorySchema.validate({ name, quantity, sku, location });
        if (error) {
            throw new Error(`Validation error: ${error.details[0].message}`);
        }

        const inventory = new Inventory({
            name,
            quantity,
            sku,
            location
        });

        await inventory.save();
        return inventory;
    } catch (error) {
        console.error(error);
        throw new Error(`Error creating inventory: ${error.message}`);
    }
};

// Update inventory by ID with validation
const updateInventory = async (id, updates = {}) => {
    try {
        if (!id) {
            throw new Error('ID parameter is required');
        }

        const updatedInventory = await Inventory.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!updatedInventory) {
            throw new Error('Inventory not found');
        }

        return updatedInventory;
    } catch (error) {
        console.error(error);
        throw new Error(`Error updating inventory: ${error.message}`);
    }
};

// Delete inventory by ID with validation
const deleteInventory = async (id) => {
    try {
        if (!id) {
            throw new Error('ID parameter is required');
        }

        const deletedInventory = await Inventory.findByIdAndDelete(id);
        if (!deletedInventory) {
            throw new Error('Inventory not found');
        }

        return { message: 'Inventory deleted successfully' };
    } catch (error) {
        console.error(error);
        throw new Error(`Error deleting inventory: ${error.message}`);
    }
};

module.exports = {
    getAllInventory,
    getInventoryById,
    adjustInventory,
    createInventory,
    updateInventory,
    deleteInventory
};
