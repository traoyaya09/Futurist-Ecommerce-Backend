const express = require("express");
const router = express.Router();

// ✅ Import authentication controllers
const {
  loginController,
  registerController,
  verifyEmailController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  getUserInfoController,
} = require("../controllers/AuthController");

// ✅ Import authentication middleware
const { authenticate } = require("../middleware/authentication");

// 🟢 **User Authentication Routes**
router.post("/register", registerController); // Register new user
router.post("/login", loginController); // ✅ Login user (POST request)
router.post("/logout", authenticate, logoutController); // Logout user (Requires token)

// 🟢 **Email Verification**
router.get("/verify-email/:token", verifyEmailController); // Verify email

// 🟢 **Password Reset Routes**
router.post("/forgot-password", forgotPasswordController); // Request password reset
router.post("/reset-password/:token", resetPasswordController); // Reset password

// 🟢 **Get Authenticated User's Info**
router.get("/me", authenticate, getUserInfoController); // ✅ Requires token

// 🟢 **API Health Check**
router.get("/", (req, res) => {
  res.status(200).json({ message: "Authentication API is running" });
});

// 🟢 **Global Error Handler (Optional)**
router.use((err, req, res, next) => {
  console.error("Auth Route Error:", err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

module.exports = router;
