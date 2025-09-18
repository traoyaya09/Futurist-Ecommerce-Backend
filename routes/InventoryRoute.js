const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/InventoryController');
const { validateInventoryData, validateIdParam, validateAdjustment } = require('../middleware/validation');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');
const { getSocketInstance } = require('../socket'); // Import socket.io instance

// GET all inventory items with optional pagination, sorting, and filtering (Public Route)
router.get('/', inventoryController.getAllInventory);

// GET inventory by ID (Public Route)
router.get('/:id', validateIdParam, inventoryController.getInventoryById);

// POST create new inventory (protected, admin only)
router.post('/', authenticate, authorize('Admin'), validateInventoryData, async (req, res) => {
  const newInventory = await inventoryController.createInventory(req, res);
  getSocketInstance().emit('inventoryCreated', newInventory); // Emit event
});

// PUT update inventory by ID (protected, admin only)
router.put('/:id', authenticate, authorize('Admin'), validateIdParam, validateInventoryData, async (req, res) => {
  const updatedInventory = await inventoryController.updateInventory(req, res);
  getSocketInstance().emit('inventoryUpdated', updatedInventory); // Emit event
});

// PATCH adjust inventory (protected, admin only)
router.patch('/:id/adjust', authenticate, authorize('Admin'), validateIdParam, validateAdjustment, async (req, res) => {
  const adjustedInventory = await inventoryController.adjustInventory(req, res);
  getSocketInstance().emit('inventoryAdjusted', adjustedInventory); // Emit event
});

// DELETE inventory by ID (protected, admin only)
router.delete('/:id', authenticate, authorize('Admin'), validateIdParam, async (req, res) => {
  const deletedInventory = await inventoryController.deleteInventory(req, res);
  getSocketInstance().emit('inventoryDeleted', { id: req.params.id }); // Emit event
});

module.exports = router;