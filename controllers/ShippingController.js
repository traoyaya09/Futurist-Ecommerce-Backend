const ShippingService = require('../services/ShippingService'); // Using ShippingService for logic
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');  // Assuming logger like winston
const { getSocketInstance } = require('../socket');

const shippingController = {
  // Create new shipping entry
  createShipping: async (req, res) => {
    try {
      // Validate incoming data
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Extract shipping details from the request body
      const { user, address, city, postalCode, country, method, estimatedDelivery } = req.body;

      // Create a new shipping record via the service
      const newShipping = await ShippingService.createShipping(
        user,
        { address, city, postalCode, country, method, estimatedDelivery }
      );
      
      // Emit socket event for shipping creation
      const io = getSocketInstance();
      io.emit('shipping:created', newShipping);

      // Return response
      res.status(201).json({ message: 'Shipping created successfully', shipping: newShipping });
    } catch (error) {
      logger.error(`Error creating shipping: ${error.message}`);
      res.status(500).json({ message: 'Error creating shipping', error: error.message });
    }
  },

  // Get shipping details by ID
  getShippingById: async (req, res) => {
    try {
      const { id } = req.params;
      const shipping = await ShippingService.getShipmentById(id);

      if (!shipping) {
        logger.warn(`Shipping not found with ID: ${id}`);
        return res.status(404).json({ message: 'Shipping not found' });
      }

      res.status(200).json(shipping);
    } catch (error) {
      logger.error(`Error fetching shipping: ${error.message}`);
      res.status(500).json({ message: 'Error fetching shipping', error: error.message });
    }
  },

  // Update the shipping status (e.g., 'Shipped', 'In Transit', 'Delivered')
  updateShippingStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      if (!['Pending', 'Shipped', 'In Transit', 'Delivered', 'Cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const updatedShipping = await ShippingService.updateShippingStatus(id, status);
      
      // Emit socket event for shipping status update
      const io = getSocketInstance();
      io.emit('shipping:statusUpdated', updatedShipping);

      // Return response
      res.status(200).json({ message: 'Shipping status updated successfully', shipping: updatedShipping });
    } catch (error) {
      logger.error(`Error updating shipping status: ${error.message}`);
      res.status(500).json({ message: 'Error updating shipping status', error: error.message });
    }
  },

  // Calculate shipping cost for an order
  calculateShipping: async (req, res) => {
    try {
      const { weight, dimensions, destination } = req.body;

      // Perform shipping cost calculation via the service
      const shippingCost = await ShippingService.calculateShippingCost({ weight, dimensions, destination });
      res.status(200).json({ shippingCost });
    } catch (error) {
      logger.error(`Error calculating shipping cost: ${error.message}`);
      res.status(500).json({ message: 'Error calculating shipping cost', error: error.message });
    }
  },

  // Track a shipment using its tracking number
  trackShipment: async (req, res) => {
    try {
      const { trackingNumber } = req.params;

      // Track shipment via the service
      const trackingInfo = await ShippingService.trackShipping(trackingNumber);
      if (!trackingInfo) {
        logger.warn(`Tracking information not found for number: ${trackingNumber}`);
        return res.status(404).json({ message: 'Tracking information not found' });
      }

      res.status(200).json(trackingInfo);
    } catch (error) {
      logger.error(`Error tracking shipment: ${error.message}`);
      res.status(500).json({ message: 'Error tracking shipment', error: error.message });
    }
  },

  // Delete a shipping record (e.g., for admin purposes)
  deleteShipping: async (req, res) => {
    try {
      const { id } = req.params;
      const shipping = await ShippingService.deleteShipping(id);

      if (!shipping) {
        logger.warn(`Shipping not found with ID: ${id}`);
        return res.status(404).json({ message: 'Shipping not found' });
      }

      // Emit socket event for shipping deletion
      const io = getSocketInstance();
      io.emit('shipping:deleted', id);

      logger.info(`Shipping with ID: ${id} deleted successfully`);
      res.status(200).json({ message: 'Shipping deleted successfully' });
    } catch (error) {
      logger.error(`Error deleting shipping: ${error.message}`);
      res.status(500).json({ message: 'Error deleting shipping', error: error.message });
    }
  }
};

module.exports = shippingController;
