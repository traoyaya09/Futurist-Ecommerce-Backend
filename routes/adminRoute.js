const express = require("express");
const router = express.Router();
const {
  getDashboardData,
  getUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  getOrders,
  updateOrderStatus,
  deleteOrder,
} = require("../controllers/AdminController");

const { authenticate } = require("../middleware/authentication");
const { authorize } = require("../middleware/authorization");

// ✅ Apply authentication and admin authorization globally
router.use(authenticate);
router.use(authorize("Admin"));

// Dashboard route (Admin only)
router.get("/dashboard", getDashboardData);

// User management routes
router.get("/users", getUsers);
router.get("/users/:userId", getUserById);
router.delete("/users/:userId", deleteUser);
router.put("/users/:userId/role", updateUserRole);

// Order management routes
router.get("/orders", getOrders);
router.put("/orders/:orderId/status", updateOrderStatus);
router.delete("/orders/:orderId", deleteOrder);

module.exports = router;
