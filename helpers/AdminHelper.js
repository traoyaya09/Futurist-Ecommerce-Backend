const User = require("../models/UserModel");
const Order = require("../models/OrderModel");

// Helper to count users
const countUsers = async () => {
  return await User.countDocuments();
};

// Helper to count orders
const countOrders = async () => {
  return await Order.countDocuments();
};

// Helper to calculate total revenue
const calculateTotalRevenue = async () => {
  const totalRevenue = await Order.aggregate([
    { $match: { paymentStatus: "Paid" } },
    { $group: { _id: null, totalRevenue: { $sum: "$netAmount" } } },
  ]);
  return totalRevenue[0]?.totalRevenue || 0;
};

// Helper to get all users (excluding passwords)
const fetchUsers = async () => {
  return await User.find().select("-password");
};

// Helper to get a user by ID
const fetchUserById = async (userId) => {
  return await User.findById(userId).select("-password");
};

// Helper to delete a user
const removeUser = async (userId) => {
  return await User.findByIdAndDelete(userId);
};

// Helper to update user role
const modifyUserRole = async (userId, role) => {
  return await User.findByIdAndUpdate(userId, { role }, { new: true });
};

// Helper to fetch all orders
const fetchOrders = async () => {
  return await Order.find().populate("userId", "name email");
};

// Helper to update order status
const modifyOrderStatus = async (orderId, status) => {
  return await Order.findByIdAndUpdate(orderId, { status }, { new: true });
};

// Helper to delete an order
const removeOrder = async (orderId) => {
  return await Order.findByIdAndDelete(orderId);
};

module.exports = {
  countUsers,
  countOrders,
  calculateTotalRevenue,
  fetchUsers,
  fetchUserById,
  removeUser,
  modifyUserRole,
  fetchOrders,
  modifyOrderStatus,
  removeOrder,
};
