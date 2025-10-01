const Order = require('../models/OrderModel');
const ShippingService = require('./ShippingService');
const logger = require('../utils/logger');
const { getSocketInstance } = require('../socket');

const VALID_PAYMENT_METHODS = ['Credit Card', 'PayPal', 'Cash on Delivery', 'Bank Transfer'];

/**
 * Calculates totalItemPrice for each item and order totals
 */
const prepareItemsAndTotals = (items) => {
  if (!items?.length) throw new Error('Order must contain at least one item');

  const preparedItems = items.map(item => {
    if (!item.product) throw new Error('Each item must have a product');
    if (typeof item.quantity !== 'number' || item.quantity <= 0) throw new Error('Invalid item quantity');
    if (typeof item.price !== 'number' || item.price < 0) throw new Error('Invalid item price');

    const discount = item.discount || 0;
    const totalItemPrice = item.price * item.quantity - discount;

    return { ...item, totalItemPrice };
  });

  const totalAmount = preparedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = preparedItems.reduce((sum, i) => sum + (i.discount || 0), 0);
  const netAmount = totalAmount - discountAmount;

  return { preparedItems, totalAmount, discountAmount, netAmount };
};

/**
 * Validates shipping address
 */
const validateShippingAddress = (shippingAddress) => {
  if (!shippingAddress || typeof shippingAddress !== 'object') throw new Error('Shipping address must be an object');
  const requiredFields = ['name', 'address', 'city', 'postalCode', 'phone', 'country'];
  for (const field of requiredFields) {
    if (!shippingAddress[field]) throw new Error(`Shipping address must include ${field}`);
  }
};

/**
 * Create an order, generate shipment, and return populated order
 */
const createOrder = async ({ userId, items, paymentMethod, shippingAddress }) => {
  try {
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) throw new Error(`Invalid payment method: ${paymentMethod}`);

    // Prepare items & calculate totals
    const { preparedItems, totalAmount, discountAmount, netAmount } = prepareItemsAndTotals(items);

    // Validate shipping
    validateShippingAddress(shippingAddress);

    // Create order
    const order = new Order({
      userId,
      items: preparedItems,
      totalAmount,
      discountAmount,
      netAmount,
      paymentMethod,
      shippingAddress,
      shippingStatus: 'Not Shipped',
      status: 'Pending',
    });

    const savedOrder = await order.save();

    // Create shipping
    const shipping = await ShippingService.createShipping({
      userId,
      orderId: savedOrder._id,
      shippingAddress
    });

    // Populate order for response
    const populatedOrder = await Order.findById(savedOrder._id).lean();
    populatedOrder.trackingNumbers = shipping.packages.map(p => p.trackingNumber);
    populatedOrder.shipments = [shipping];

    // Emit real-time socket event
    try {
      const io = getSocketInstance();
      io.to(`user:${userId}`).emit('order:created', populatedOrder);
    } catch (socketErr) {
      logger.warn(`Failed to emit order:created event: ${socketErr.message}`);
    }

    return populatedOrder;
  } catch (err) {
    logger.error(`Failed to create order: ${err.message}`);
    throw new Error(`Failed to create order: ${err.message}`);
  }
};

/**
 * Get order by ID with shipments populated
 */
const getOrderById = async (orderId) => {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error('Order not found');

    const shipments = await ShippingService.getShipmentsByUser(order.userId);
    order.shipments = shipments.filter(s =>
      s.packages.some(p => order.trackingNumbers?.includes(p.trackingNumber))
    );

    return order;
  } catch (err) {
    logger.error(`Error fetching order: ${err.message}`);
    throw new Error('Failed to fetch order');
  }
};

/**
 * Update order status
 */
const updateOrderStatus = async (orderId, status) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.status = status;
    await order.save();

    logger.info(`Order ${orderId} status updated → ${status}`);
    return order;
  } catch (err) {
    logger.error(`Error updating order status: ${err.message}`);
    throw new Error('Failed to update order status');
  }
};

/**
 * Cancel an order
 */
const cancelOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.status = 'Cancelled';
    order.shippingStatus = 'Cancelled';
    await order.save();

    logger.info(`Order ${orderId} cancelled`);
    return order;
  } catch (err) {
    logger.error(`Error cancelling order: ${err.message}`);
    throw new Error('Failed to cancel order');
  }
};

/**
 * Delete an order
 */
const deleteOrder = async (orderId) => {
  try {
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) throw new Error('Order not found');

    logger.info(`Order ${orderId} deleted`);
    return order;
  } catch (err) {
    logger.error(`Error deleting order: ${err.message}`);
    throw new Error('Failed to delete order');
  }
};

/**
 * Filter orders by criteria
 */
const filterOrders = async (filters) => {
  try {
    const query = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.shippingStatus) query.shippingStatus = filters.shippingStatus;

    return await Order.find(query).lean();
  } catch (err) {
    logger.error(`Error filtering orders: ${err.message}`);
    throw new Error('Failed to filter orders');
  }
};

/**
 * Get all orders with pagination, filtering, and search
 */
const getAllOrders = async ({ page = 1, limit = 20, filters = {} }) => {
  try {
    const query = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.shippingStatus) query.shippingStatus = filters.shippingStatus;

    if (filters.searchQuery) {
      const regex = new RegExp(filters.searchQuery, 'i');
      query.$or = [
        { 'shippingAddress.name': regex },
        { 'shippingAddress.address': regex },
        { 'shippingAddress.city': regex },
        { 'shippingAddress.postalCode': regex },
        { 'shippingAddress.phone': regex },
        { 'shippingAddress.country': regex }
      ];
    }

    const total = await Order.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { orders, total, pages };
  } catch (err) {
    logger.error(`Error fetching all orders: ${err.message}`);
    throw new Error('Failed to get all orders');
  }
};

module.exports = {
  createOrder,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  filterOrders,
  getAllOrders
};
