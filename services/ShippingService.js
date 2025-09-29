const Shipping = require('../models/ShippingModel');
const Order = require('../models/OrderModel');
const { calculateShippingCost, trackShipment } = require('../utils/ShippingCostCalculation');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid'); // For generating tracking numbers

// Create a shipping record for a user (used by Order creation or manually)
const createShipping = async (userId, shippingData, orderId = null) => {
  try {
    const shippingCost = await calculateShippingCost(shippingData);

    // Generate tracking numbers automatically for each package
    const packagesWithTracking = (shippingData.packages || []).map(pkg => ({
      ...pkg,
      trackingNumber: uuidv4()
    }));

    const newShipping = new Shipping({
      user: userId,
      address: shippingData.address,
      city: shippingData.city,
      postalCode: shippingData.postalCode,
      country: shippingData.country,
      method: shippingData.method,
      estimatedDelivery: shippingData.estimatedDelivery,
      shippingCost,
      packages: packagesWithTracking,
      insurance: shippingData.insurance || false,
      insuranceValue: shippingData.insuranceValue || 0,
      status: 'Pending'
    });

    const savedShipping = await newShipping.save();

    // If linked to an order, update order trackingNumbers array
    if (orderId) {
      const trackingNumbers = packagesWithTracking.map(p => p.trackingNumber);
      await Order.findByIdAndUpdate(orderId, { $push: { trackingNumbers: { $each: trackingNumbers } } });
    }

    logger.info(`Shipping created for user: ${userId}, tracking numbers: ${packagesWithTracking.map(p => p.trackingNumber)}`);
    return savedShipping;
  } catch (error) {
    logger.error(`Error creating shipping record: ${error.message}`);
    throw new Error('Error creating shipping record');
  }
};

// Update shipping status and auto-update order status if needed
const updateShippingStatus = async (shippingId, status) => {
  try {
    const shipping = await Shipping.findById(shippingId);
    if (!shipping) throw new Error('Shipping record not found');

    shipping.status = status;

    if (status === 'Shipped' && !shipping.dispatchedAt) shipping.dispatchedAt = new Date();
    if (status === 'Delivered' && !shipping.deliveredAt) shipping.deliveredAt = new Date();

    const updatedShipping = await shipping.save();

    // Auto-update order status if linked
    const orders = await Order.find({ trackingNumbers: { $in: shipping.packages.map(p => p.trackingNumber) } });
    for (const order of orders) {
      const allShipped = await Shipping.countDocuments({
        _id: { $in: order.trackingNumbers.map(t => t) },
        status: { $nin: ['Shipped', 'Delivered'] }
      }) === 0;

      const allDelivered = await Shipping.countDocuments({
        _id: { $in: order.trackingNumbers.map(t => t) },
        status: { $ne: 'Delivered' }
      }) === 0;

      if (allDelivered) order.status = 'Delivered';
      else if (allShipped) order.status = 'Shipped';
      await order.save();
    }

    logger.info(`Shipping status updated for shipping ID: ${shippingId}, new status: ${status}`);
    return updatedShipping;
  } catch (error) {
    logger.error(`Error updating shipping status: ${error.message}`);
    throw new Error('Error updating shipping status');
  }
};

const getShipmentsByUser = async (userId, status) => {
  try {
    const query = { user: userId };
    if (status) query.status = status;
    return Shipping.find(query).populate('user', 'name email');
  } catch (error) {
    logger.error(`Error fetching shipments for user: ${error.message}`);
    throw new Error('Error fetching shipments');
  }
};

const trackShipping = async (trackingNumber) => {
  try {
    return trackShipment(trackingNumber);
  } catch (error) {
    logger.error(`Error tracking shipment: ${error.message}`);
    throw new Error('Error tracking shipment');
  }
};

const deleteShipping = async (shippingId) => {
  try {
    const shipping = await Shipping.findByIdAndDelete(shippingId);
    if (!shipping) throw new Error('Shipping not found');
    return shipping;
  } catch (error) {
    logger.error(`Error deleting shipping: ${error.message}`);
    throw new Error('Error deleting shipping');
  }
};
const calculateShipping = async (shippingData) => {
  try {
    const cost = await calculateShippingCost(shippingData);
    return cost;
  } catch (error) {
    logger.error(`Error calculating shipping cost: ${error.message}`);
    throw new Error('Error calculating shipping cost');
  }
};

module.exports = {
  createShipping,
  updateShippingStatus,
  getShipmentsByUser,
  trackShipping,
  deleteShipping,
  calculateShipping
};
