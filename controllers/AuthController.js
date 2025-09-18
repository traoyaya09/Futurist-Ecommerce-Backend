const userModel = require("../models/UserModel");
const { comparePassword, hashPassword, generateToken } = require("../helpers/AuthHelper");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

const { sendVerificationEmail } = require('../services/EmailService');
const { sendForgotPasswordEmail } = require('../services/EmailService');
const { sendResetPasswordEmail } = require('../services/EmailService');
// Import the socket instance
const { getSocketInstance } = require('../socket');

// 🟢 Register a new user
const registerController = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name, email, password } = req.body;
        const normalizedEmail = email.toLowerCase();

        // Check if user already exists
        const existingUser = await userModel.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User already registered. Please log in." });
        }

        const newUser = new userModel({
            name,
            email: normalizedEmail,
            password,
            isVerified: false,
        });

        await newUser.save();

        // Emit event for new user registration
        const io = getSocketInstance();
        io.emit('user:registered', { id: newUser._id, name: newUser.name, email: newUser.email });

        // ✅ Generate email verification token
        const verificationToken = jwt.sign({ userId: newUser._id }, config.jwt.secret, { expiresIn: "1d" });

        // ✅ Send Verification Email
        await sendVerificationEmail(newUser, verificationToken);

        res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify your email.",
        });
    } catch (error) {
        console.error("❌ Registration Error:", error.message);
        res.status(500).json({ success: false, message: "Server error during registration" });
    }
};

// 🟢 Login User
const loginController = async (req, res) => {
    try {
        console.log("🔹 Login Request Received:", req.body);

        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const normalizedEmail = email.toLowerCase();
        console.log("🔹 Normalized Email:", normalizedEmail);

        // 🔹 Find user in database
        const user = await userModel.findOne({ email: normalizedEmail });

        if (!user) {
            console.error("❌ User not found:", normalizedEmail);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log("🔹 Stored Hashed Password:", user.password);
        const isPasswordValid = await user.comparePassword(password); // ✅ Using user model method

        if (!isPasswordValid) {
            console.error("❌ Invalid password attempt for:", email);
            return res.status(400).json({ success: false, message: "Invalid password" });
        }

        // ✅ Generate Tokens
        const { accessToken, refreshToken } = generateToken(user);
        console.log("✅ Generated Access Token:", accessToken);

        // Emit event for successful login
        const io = getSocketInstance();
        io.emit('user:loggedIn', { id: user._id, name: user.name, email: user.email });

        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("❌ Server Error During Login:", error);
        res.status(500).json({ success: false, message: "Server error during login" });
    }
};

// 🟢 Verify Email
const verifyEmailController = async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await userModel.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Invalid verification token" });
        }

        user.isVerified = true;
        await user.save();

        // Emit email verified event
        const io = getSocketInstance();
        io.emit('user:emailVerified', user._id);

        res.status(200).json({ success: true, message: "Email verified successfully. You can now log in." });
    } catch (error) {
        console.error("Email Verification Error:", error.message);
        res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
};

// 🟢 Logout User
const logoutController = async (req, res) => {
    try {
        // Optionally, emit an event for logout (if needed)
        const io = getSocketInstance();
        io.emit('user:loggedOut', req.user._id);

        // Invalidate tokens (handled at frontend, or via a DB blacklist)
        res.status(200).json({ success: true, message: "User logged out successfully" });
    } catch (error) {
        console.error("Logout Error:", error.message);
        res.status(500).json({ success: false, message: "Error logging out" });
    }
};

// 🟢 Get User Info (Authenticated)
const getUserInfoController = async (req, res) => {
    try {
        const user = await userModel.findById(req.user._id).select("-password");
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching user data" });
    }
};

const forgotPasswordController = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ✅ Generate password reset token
        user.generatePasswordResetToken();
        await user.save();

        // ✅ Send password reset email
        await sendForgotPasswordEmail(user);

        res.status(200).json({ success: true, message: "Password reset email sent. Check your inbox." });
    } catch (error) {
        console.error("Error in forgot password:", error.message);
        res.status(500).json({ success: false, message: "Error in password reset request" });
    }
};

const resetPasswordController = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ Generate password reset token
        const resetToken = jwt.sign({ userId: user._id }, config.jwt.secret, { expiresIn: "1h" });

        // ✅ Send Reset Password Email
        await sendResetPasswordEmail(user, resetToken);

        res.status(200).json({ message: "Password reset link sent. Check your email." });
    } catch (error) {
        console.error("Error in password reset request:", error.message);
        res.status(500).json({ message: "Server error during password reset request" });
    }
};

module.exports = {
    registerController,
    verifyEmailController,
    loginController,
    logoutController,
    forgotPasswordController,
    resetPasswordController,
    getUserInfoController,
};
