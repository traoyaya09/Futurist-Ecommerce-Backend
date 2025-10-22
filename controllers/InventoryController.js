const Inventory = require('../models/InventoryModel');
const { getSocketInstance } = require('../socket');

const InventoryController = {
  // Fetch all inventory items with optional filtering, sorting, and pagination
  getAllInventory: async (req, res) => {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', ...filter } = req.query;

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const inventory = await Inventory.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

      const total = await Inventory.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      res.status(200).json({ inventory, total, totalPages, page: Number(page), limit: Number(limit) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching inventory' });
    }
  },

  // Fetch inventory by ID with validation
  getInventoryById: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID parameter is required' });

      const inventory = await Inventory.findById(id);
      if (!inventory) return res.status(404).json({ error: 'Inventory not found' });

      res.status(200).json(inventory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Error fetching inventory by ID: ${error.message}` });
    }
  },

  // Adjust inventory quantity (increase/decrease)
  adjustInventory: async (req, res) => {
    try {
      const { id } = req.params;
      const { adjustmentType, quantity, userId } = req.body;

      if (!id || !adjustmentType || typeof quantity !== 'number') {
        return res.status(400).json({ error: 'Invalid input: ID, adjustment type, and quantity are required' });
      }

      const inventory = await Inventory.findById(id);
      if (!inventory) return res.status(404).json({ error: 'Inventory not found' });

      let action;
      if (adjustmentType === 'increase') {
        inventory.quantity += quantity;
        action = 'increase';
      } else if (adjustmentType === 'decrease') {
        if (inventory.quantity < quantity) return res.status(400).json({ error: 'Not enough stock to decrease' });
        inventory.quantity -= quantity;
        action = 'decrease';
      } else {
        return res.status(400).json({ error: 'Invalid adjustment type' });
      }

      // Update stock status
      if (inventory.quantity <= 0) {
        inventory.stockStatus = 'out-of-stock';
      } else if (inventory.quantity <= inventory.lowStockThreshold) {
        inventory.stockStatus = 'low-stock';
      } else {
        inventory.stockStatus = 'in-stock';
      }

      // Push adjustment history
      inventory.stockHistory.push({
        action,
        quantity: Math.abs(inventory.quantity - quantity),
        adjustedBy: userId
      });

      const updatedInventory = await inventory.save();

      // Emit socket event for inventory adjustment
      const io = getSocketInstance();
      io.emit('inventory:adjusted', updatedInventory);

      res.status(200).json(updatedInventory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Error adjusting inventory: ${error.message}` });
    }
  },

  // Create new inventory item
  createInventory: async (req, res) => {
    try {
      const { name, quantity, sku, location = 'Main Warehouse' } = req.body;

      if (!name || typeof quantity !== 'number' || !sku) {
        return res.status(400).json({ error: 'Invalid input: Name, quantity, and SKU are required' });
      }

      const inventory = new Inventory({ name, quantity, sku, location });
      const savedInventory = await inventory.save();

      // Emit socket event for inventory creation
      const io = getSocketInstance();
      io.emit('inventory:created', savedInventory);

      res.status(201).json(savedInventory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Error creating inventory: ${error.message}` });
    }
  },

  // Update inventory by ID
  updateInventory: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID parameter is required' });

      const updatedInventory = await Inventory.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!updatedInventory) return res.status(404).json({ error: 'Inventory not found' });

      // Emit socket event for inventory update
      const io = getSocketInstance();
      io.emit('inventory:updated', updatedInventory);

      res.status(200).json(updatedInventory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Error updating inventory: ${error.message}` });
    }
  },

  // Delete inventory by ID
  deleteInventory: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID parameter is required' });

      const deletedInventory = await Inventory.findByIdAndDelete(id);
      if (!deletedInventory) return res.status(404).json({ error: 'Inventory not found' });

      // Emit socket event for inventory deletion
      const io = getSocketInstance();
      io.emit('inventory:deleted', id);

      res.status(200).json({ message: 'Inventory deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: `Error deleting inventory: ${error.message}` });
    }
  }
};

module.exports = InventoryController;
