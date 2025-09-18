const {
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
} = require("../helpers/AdminHelper");

// Import the socket instance
const { getSocketInstance } = require('../socket');

// Get admin dashboard data
const getDashboardData = async (req, res) => {
  try {
    const userCount = await countUsers();
    const orderCount = await countOrders();
    const totalRevenue = await calculateTotalRevenue();

    res.status(200).json({ userCount, orderCount, totalRevenue });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Server error while fetching dashboard data" });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await fetchUsers();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// Get a user by ID
const getUserById = async (req, res) => {
  try {
    const user = await fetchUserById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Error fetching user data" });
  }
};

// Delete a user and emit a socket event
const deleteUser = async (req, res) => {
  try {
    const user = await removeUser(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Emit user deletion event
    const io = getSocketInstance();
    io.emit('user:deleted', req.params.userId);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
};

// Update user role and emit a socket event
const updateUserRole = async (req, res) => {
  try {
    const user = await modifyUserRole(req.params.userId, req.body.role);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Emit role updated event
    const io = getSocketInstance();
    io.emit('user:roleUpdated', user);

    res.status(200).json(user);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Error updating user role" });
  }
};

// Get all orders
const getOrders = async (req, res) => {
  try {
    const orders = await fetchOrders();
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// Update order status and emit a socket event
const updateOrderStatus = async (req, res) => {
  try {
    const order = await modifyOrderStatus(req.params.orderId, req.body.status);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Emit order status update event
    const io = getSocketInstance();
    io.emit('order:statusUpdated', order);

    res.status(200).json(order);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Error updating order status" });
  }
};

// Delete an order and emit a socket event
const deleteOrder = async (req, res) => {
  try {
    const order = await removeOrder(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Emit order deletion event
    const io = getSocketInstance();
    io.emit('order:deleted', req.params.orderId);

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Error deleting order" });
  }
};

module.exports = {
  getDashboardData,
  getUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  getOrders,
  updateOrderStatus,
  deleteOrder,
};
