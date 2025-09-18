const Shipping = require('../models/ShippingModel'); // Shipping model for database interaction
const { calculateShippingCost, trackShipment } = require('../utils/ShippingCostCalculation'); // Functions for shipping calculations and tracking
const logger = require('../utils/logger');  // Logger utility

// Create a new shipping record
const createShipping = async (userData, shippingData) => {
  try {
    // Calculate the shipping cost
    const shippingCost = await calculateShippingCost(shippingData);

    // Create a new shipping record
    const newShipping = new Shipping({
      user: userData._id, // Assumed user data passed in
      address: shippingData.address,
      city: shippingData.city,
      postalCode: shippingData.postalCode,
      country: shippingData.country,
      method: shippingData.method,
      estimatedDelivery: shippingData.estimatedDelivery,
      shippingCost: shippingCost,
      trackingNumbers: [],
      packages: shippingData.packages,
      insurance: shippingData.insurance || false,
      insuranceValue: shippingData.insuranceValue || 0,
      dispatchedAt: null,  // Dispatch date will be updated when the package is shipped
      deliveredAt: null,  // Delivery date will be updated when the package is delivered
    });

    // Save the new shipping record
    const savedShipping = await newShipping.save();
    logger.info(`Shipping created for user: ${userData._id}, tracking number: ${savedShipping.trackingNumbers}`);

    return savedShipping;
  } catch (error) {
    logger.error(`Error creating shipping record: ${error.message}`);
    throw new Error('Error creating shipping record');
  }
};

// Update the shipping status (e.g., "Shipped", "Delivered")
const updateShippingStatus = async (shippingId, status) => {
  try {
    // Find the shipping record
    const shipping = await Shipping.findById(shippingId);
    if (!shipping) {
      throw new Error('Shipping record not found');
    }

    // Update the status
    shipping.status = status;

    // Set the dispatchedAt or deliveredAt based on the status
    if (status === 'Shipped' && !shipping.dispatchedAt) {
      shipping.dispatchedAt = new Date();
    } else if (status === 'Delivered' && !shipping.deliveredAt) {
      shipping.deliveredAt = new Date();
    }

    // Save the updated shipping record
    const updatedShipping = await shipping.save();
    logger.info(`Shipping status updated for shipping ID: ${shippingId}, new status: ${status}`);

    return updatedShipping;
  } catch (error) {
    logger.error(`Error updating shipping status: ${error.message}`);
    throw new Error('Error updating shipping status');
  }
};

// Track a shipment using its tracking number
const trackShipping = async (trackingNumber) => {
  try {
    const trackingInfo = await trackShipment(trackingNumber);

    // Here, you could return the tracking info to the user or update the status
    return trackingInfo;
  } catch (error) {
    logger.error(`Error tracking shipment with tracking number: ${trackingNumber} - ${error.message}`);
    throw new Error('Error tracking shipment');
  }
};

// Get all shipments for a user
const getShipmentsByUser = async (userId, status) => {
  try {
    const query = { user: userId };
    if (status) query.status = status;

    // Get all shipments for the user, with optional status filtering
    const shipments = await Shipping.find(query).populate('user', 'name email');

    return shipments;
  } catch (error) {
    logger.error(`Error fetching shipments for user ID: ${userId} - ${error.message}`);
    throw new Error('Error fetching shipments');
  }
};

// Get specific shipment details by ID
const getShipmentById = async (shippingId) => {
  try {
    // Find a specific shipment record by its ID
    const shipment = await Shipping.findById(shippingId).populate('user', 'name email');

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    return shipment;
  } catch (error) {
    logger.error(`Error fetching shipment by ID: ${shippingId} - ${error.message}`);
    throw new Error('Error fetching shipment details');
  }
};

module.exports = {
  createShipping,
  updateShippingStatus,
  trackShipping,
  getShipmentsByUser,
  getShipmentById,
};
