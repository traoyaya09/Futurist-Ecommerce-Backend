const ShippingService = require('../services/ShippingService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { getSocketInstance } = require('../socket');

const shippingController = {
  // Create a new shipping
  createShipping: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { user, address, city, postalCode, country, method, estimatedDelivery, packages, insurance, insuranceValue } = req.body;

      const shipping = await ShippingService.createShipping(user, {
        address, city, postalCode, country, method, estimatedDelivery, packages, insurance, insuranceValue
      });

      const io = getSocketInstance();
      io.emit('shipping:created', shipping);

      res.status(201).json({ message: 'Shipping created successfully', shipping });
    } catch (error) {
      logger.error(`Error creating shipping: ${error.message}`);
      res.status(500).json({ message: 'Error creating shipping', error: error.message });
    }
  },

  // Get shipments for logged-in user
  getUserShipments: async (req, res) => {
    try {
      const userId = req.user._id;
      const { status } = req.query;
      const shipments = await ShippingService.getShipmentsByUser(userId, status);
      res.status(200).json(shipments);
    } catch (error) {
      logger.error(`Error fetching shipments: ${error.message}`);
      res.status(500).json({ message: 'Error fetching shipments', error: error.message });
    }
  },

  // Get a single shipment by ID
  getShippingById: async (req, res) => {
    try {
      const { id } = req.params;
      const shipping = await ShippingService.getShipmentById(id);
      res.status(200).json(shipping);
    } catch (error) {
      logger.error(`Error fetching shipment: ${error.message}`);
      res.status(404).json({ message: error.message });
    }
  },

  // Update shipping status
  updateShippingStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['Pending','Shipped','In Transit','Delivered','Canceled','Returned'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const shipping = await ShippingService.updateShippingStatus(id, status);

      const io = getSocketInstance();
      io.emit('shipping:statusUpdated', shipping);

      res.status(200).json({ message: 'Shipping status updated', shipping });
    } catch (error) {
      logger.error(`Error updating shipping status: ${error.message}`);
      res.status(500).json({ message: 'Error updating shipping status', error: error.message });
    }
  },

  // Track shipment
  trackShipment: async (req, res) => {
    try {
      const { trackingNumber } = req.params;
      const trackingInfo = await ShippingService.trackShipping(trackingNumber);
      if (!trackingInfo) return res.status(404).json({ message: 'Tracking info not found' });
      res.status(200).json(trackingInfo);
    } catch (error) {
      logger.error(`Error tracking shipment: ${error.message}`);
      res.status(500).json({ message: 'Error tracking shipment', error: error.message });
    }
  },

  // Calculate shipping cost without creating a record
  calculateShipping: async (req, res) => {
    try {
      const { address, city, postalCode, country, method, packages, insurance, insuranceValue } = req.body;

      const cost = await ShippingService.calculateShipping({
        address, city, postalCode, country, method, packages, insurance, insuranceValue
      });

      res.status(200).json({ shippingCost: cost });
    } catch (error) {
      logger.error(`Error calculating shipping: ${error.message}`);
      res.status(500).json({ message: 'Error calculating shipping', error: error.message });
    }
  },

  // Delete a shipping
  deleteShipping: async (req, res) => {
    try {
      const { id } = req.params;
      const shipping = await ShippingService.deleteShipping(id);
      if (!shipping) return res.status(404).json({ message: 'Shipping not found' });

      const io = getSocketInstance();
      io.emit('shipping:deleted', id);

      res.status(200).json({ message: 'Shipping deleted successfully' });
    } catch (error) {
      logger.error(`Error deleting shipping: ${error.message}`);
      res.status(500).json({ message: 'Error deleting shipping', error: error.message });
    }
    
  }



  
};



module.exports = shippingController;
