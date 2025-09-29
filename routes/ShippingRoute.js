const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/ShippingController');
const { validateShipping, validateTrackingNumber } = require('../validators/shippingValidator');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Create a new shipping (Admin Only)
router.post(
  '/',
  authenticate,
  authorize('Admin'),
  validateShipping,
  shippingController.createShipping
);

// Get all shipments for logged-in user
router.get('/my', authenticate, shippingController.getUserShipments);

// Get a specific shipment by ID (User or Admin)
router.get('/:id', authenticate, shippingController.getShippingById);

// Update shipping status (Admin Only)
router.patch(
  '/:id/status',
  authenticate,
  authorize('Admin'),
  shippingController.updateShippingStatus
);

// Track a shipment using tracking number (Public or authenticated)
router.get(
  '/track/:trackingNumber',
  validateTrackingNumber,
  shippingController.trackShipment
);

// Delete a shipping record (Admin Only)
router.delete(
  '/:id',
  authenticate,
  authorize('Admin'),
  shippingController.deleteShipping
);
// Calculate shipping cost (Public route)
router.post('/calculate', shippingController.calculateShipping);

module.exports = router;
