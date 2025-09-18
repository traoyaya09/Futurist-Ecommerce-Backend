const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/ShippingController');
const { validateShipping, validateTrackingNumber } = require('../validators/shippingValidator');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Create a new shipping (Admin Only)
router.post('/shipping', authenticate, authorize('Admin'), validateShipping, shippingController.createShipping);

// Get shipping by ID (User or Admin)
router.get('/:id', authenticate, shippingController.getShippingById);

// Update shipping status (Admin Only)
router.put('/shipping/:id/status', authenticate, authorize('Admin'), shippingController.updateShippingStatus);

// Calculate shipping (Public Route)
router.post('/shipping/calculate', shippingController.calculateShipping);

// Track shipment (Public Route)
router.get('/shipping/track/:trackingNumber', validateTrackingNumber, shippingController.trackShipment);

// Delete shipping (Admin Only)
router.delete('/shipping/:id', authenticate, authorize('Admin'), shippingController.deleteShipping);

// Get shipping for the logged in user
router.get('/', authenticate, shippingController.getShippingById);

module.exports = router;