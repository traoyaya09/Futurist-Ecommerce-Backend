const Order = require('../models/OrderModel');
const User = require('../models/UserModel');
const ShippingService = require('./ShippingService');
const logger = require('../utils/logger');

const createOrder = async ({ userId, items, paymentMethod, shippingAddress }) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Create the order
    const order = new Order({
      userId,
      items,
      paymentMethod,
      shippingAddress,
      status: 'Pending',
      trackingNumbers: []
    });
    await order.save();

    // Automatically create shipments per item
    const shipments = [];
    for (const item of items) {
      const packageData = {
        packages: [{ product: item.productId, quantity: item.quantity, trackingNumber: `TRK-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` }],
        address: shippingAddress,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
        method: 'Standard',
        estimatedDelivery: new Date(Date.now() + 5*24*60*60*1000) // example: 5 days
      };
      const shipment = await ShippingService.createShipping(userId, packageData, order._id);
      shipments.push(shipment);
    }

    return { order, shipments };
  } catch (err) {
    logger.error(`Error creating order: ${err.message}`);
    throw err;
  }
};

const updateOrderStatus = async (orderId, status) => {
  const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) throw new Error('Invalid order status');

  const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
  if (!order) throw new Error('Order not found');
  return order;
};

const cancelOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (['Cancelled', 'Delivered'].includes(order.status)) throw new Error(`Cannot cancel order, status is ${order.status}`);

  order.status = 'Cancelled';
  await order.save();

  return order;
};

const getUserOrders = async (userId) => {
  const orders = await Order.find({ userId }).populate('items.product', 'name price');
  return orders;
};

const getAllOrders = async (page = 1, status = '', searchQuery = '') => {
  const query = {};
  if (status) query.status = status;
  if (searchQuery) query.$text = { $search: searchQuery };

  const orders = await Order.find(query)
    .skip((page - 1) * 10)
    .limit(10)
    .populate('userId', 'name email')
    .populate('items.product', 'name price');
  const totalOrders = await Order.countDocuments(query);

  return { orders, totalOrders };
};

module.exports = {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getUserOrders,
  getAllOrders
};
