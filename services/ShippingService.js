const Shipping = require('../models/ShippingModel');
const Order = require('../models/OrderModel');
const { calculateShippingCost, trackShipment } = require('../utils/ShippingCostCalculation');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { getSocketInstance } = require('../socket');

/**
 * Create a shipping record and link to order
 */
const createShipping = async ({ userId, shippingAddress, orderId }) => {
  try {
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      throw new Error('Shipping address must be an object');
    }

    const requiredFields = ['address', 'city', 'postalCode', 'country'];
    requiredFields.forEach(f => {
      if (!shippingAddress[f]) throw new Error(`Shipping address must include ${f}`);
    });

    if (!orderId) throw new Error('orderId is required');

    const shippingCost = await calculateShippingCost(shippingAddress);

    // Ensure packages exist; default to one package if none provided
    const packagesWithTracking = (shippingAddress.packages || [{
      weight: 1,
      dimensions: { length: 10, width: 10, height: 10 }
    }]).map(pkg => ({
      ...pkg,
      trackingNumber: pkg.trackingNumber || uuidv4()
    }));

    const newShipping = new Shipping({
      user: userId,
      orderId,
      address: shippingAddress.address,
      city: shippingAddress.city,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country,
      method: shippingAddress.method || 'Standard',
      estimatedDelivery: shippingAddress.estimatedDelivery,
      shippingCost,
      packages: packagesWithTracking,
      insurance: shippingAddress.insurance || false,
      insuranceValue: shippingAddress.insuranceValue || 0,
      status: 'Pending'
    });

    const savedShipping = await newShipping.save();

    // Sync tracking numbers to order
    const trackingNumbers = packagesWithTracking.map(p => p.trackingNumber);
    await Order.findByIdAndUpdate(orderId, { $push: { trackingNumbers: { $each: trackingNumbers } } });

    // Emit real-time update
    try {
      const io = getSocketInstance();
      io.to(`user:${userId}`).emit('order:updated', { orderId, trackingNumbers });
    } catch (socketErr) {
      logger.warn(`Socket emit failed: ${socketErr.message}`);
    }

    logger.info(`Shipping created for order ${orderId} - tracking: ${trackingNumbers.join(', ')}`);
    return savedShipping;

  } catch (err) {
    logger.error(`Error creating shipping: ${err.message}`);
    throw new Error(`Failed to create shipping: ${err.message}`);
  }
};

/**
 * Get shipments for a user
 */
const getShipmentsByUser = async (userId, status) => {
  try {
    const query = { user: userId };
    if (status) query.status = status;
    return await Shipping.find(query).lean();
  } catch (err) {
    logger.error(`Error fetching shipments: ${err.message}`);
    throw new Error('Failed to fetch shipments');
  }
};

/**
 * Update shipping status
 */
const updateShippingStatus = async (shippingId, status) => {
  try {
    const shipping = await Shipping.findById(shippingId);
    if (!shipping) throw new Error('Shipping record not found');

    shipping.status = status;
    if (status === 'Shipped') shipping.dispatchedAt = new Date();
    if (status === 'Delivered') shipping.deliveredAt = new Date();

    const updatedShipping = await shipping.save();

    // Update linked orders
    const orders = await Order.find({ trackingNumbers: { $in: shipping.packages.map(p => p.trackingNumber) } });
    for (const order of orders) {
      const relatedShipments = await Shipping.find({ 'packages.trackingNumber': { $in: order.trackingNumbers } });
      const allDelivered = relatedShipments.every(s => s.status === 'Delivered');
      const allShipped = relatedShipments.every(s => ['Shipped', 'Delivered'].includes(s.status));

      order.status = allDelivered ? 'Delivered' : allShipped ? 'Shipped' : 'Pending';
      await order.save();

      try {
        const io = getSocketInstance();
        io.to(`user:${order.user}`).emit('order:updated', order);
      } catch (socketErr) {
        logger.warn(`Failed to emit order:updated socket event: ${socketErr.message}`);
      }
    }

    return updatedShipping;
  } catch (err) {
    logger.error(`Error updating shipping status: ${err.message}`);
    throw new Error('Failed to update shipping status');
  }
};

/**
 * Track a shipment
 */
const trackShipping = async (trackingNumber) => {
  try {
    const info = await trackShipment(trackingNumber);
    if (!info) throw new Error('Tracking info not found');
    return info;
  } catch (err) {
    logger.error(`Error tracking shipment: ${err.message}`);
    throw new Error('Failed to track shipment');
  }
};

/**
 * Delete a shipping record
 */
const deleteShipping = async (shippingId) => {
  try {
    const shipping = await Shipping.findByIdAndDelete(shippingId);
    if (!shipping) throw new Error('Shipping not found');
    return shipping;
  } catch (err) {
    logger.error(`Error deleting shipping: ${err.message}`);
    throw new Error('Failed to delete shipping');
  }
};

/**
 * Calculate shipping cost without creating a record
 */
const calculateShipping = async (shippingData) => {
  try {
    return await calculateShippingCost(shippingData);
  } catch (err) {
    logger.error(`Error calculating shipping cost: ${err.message}`);
    throw new Error('Failed to calculate shipping cost');
  }
};

module.exports = {
  createShipping,
  getShipmentsByUser,
  updateShippingStatus,
  trackShipping,
  deleteShipping,
  calculateShipping
};
