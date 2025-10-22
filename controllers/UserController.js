const userModel = require("../models/UserModel");
const { comparePassword, hashPassword, generateToken } = require("../helpers/AuthHelper");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const JWT_SECRET = process.env.JWT_SECRET;
const { sendEmail } = require("../services/EmailService");
const { getSocketInstance } = require("../socket");

// Create email transporter to avoid redundancy
const createEmailTransporter = () => {
    return nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

// Send email utility function
// (This function is reused via sendEmail imported above)

const userController = {
    // Register user
    register: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, email, password } = req.body;
            let user = await userModel.findOne({ email });
            if (user) {
                return res.status(400).json({ message: "User already exists" });
            }

            // Hash password before saving to database
            const salt = await hashPassword(password);
            const hashedPassword = await hashPassword(password);

            user = new userModel({
                name,
                email,
                password: hashedPassword,
            });

            await user.save();

            // Emit event for new user registration
            const io = getSocketInstance();
            io.emit("user:registered", { id: user.id, name: user.name, email: user.email });

            const payload = { user: { id: user.id } };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

            res.status(201).json({
                message: "User registered successfully",
                user: { id: user.id, name: user.name, email: user.email },
                token,
            });
        } catch (error) {
            console.error("Error in registration:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // User login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            let user = await userModel.findOne({ email });

            if (!user) {
                return res.status(400).json({ message: "Invalid credentials" });
            }

            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid credentials" });
            }

            // Emit event for user login
            const io = getSocketInstance();
            io.emit("user:loggedIn", { id: user.id, name: user.name, email: user.email });

            const payload = { user: { id: user.id } };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

            res.status(200).json({
                message: "Login successful",
                user: { id: user.id, name: user.name, email: user.email },
                token,
            });
        } catch (error) {
            console.error("Error in login:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Get logged-in user profile
    getUserProfile: async (req, res) => {
        try {
            const user = await userModel.findById(req.user.id).select("-password");
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            res.status(200).json({ user });
        } catch (error) {
            console.error("Error fetching user profile:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Update user profile
    updateUserProfile: async (req, res) => {
        try {
            const { name, email, password } = req.body;
            let user = await userModel.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.name = name || user.name;
            user.email = email || user.email;

            if (password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
            }

            await user.save();

            // Emit event for profile update
            const io = getSocketInstance();
            io.emit("user:profileUpdated", { id: user.id, name: user.name, email: user.email });

            res.status(200).json({ message: "User profile updated successfully", user });
        } catch (error) {
            console.error("Error updating user profile:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Delete user account
    deleteUser: async (req, res) => {
        try {
            await userModel.findByIdAndDelete(req.user.id);

            // Emit event for user deletion
            const io = getSocketInstance();
            io.emit("user:deleted", req.user.id);

            res.status(200).json({ message: "User account deleted successfully" });
        } catch (error) {
            console.error("Error deleting user:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Admin can get all users (Optional, if applicable)
    // Admin can get all users (with pagination)
getAllUsers: async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const users = await userModel.find()
            .select("-password")
            .skip((page - 1) * limit)
            .limit(limit);

        const totalItems = await userModel.countDocuments();

        res.status(200).json({
            data: users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Server error" });
    }
},


    getUserById: async (req, res) => {
        try {
          const user = await userModel.findById(req.params.userId).select("-password");
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }
          res.status(200).json({ user });
        } catch (error) {
          console.error("Error fetching user by id:", error);
          res.status(500).json({ message: "Server error" });
        }
      },
    

    // Admin can delete user (Optional, if applicable)
    adminDeleteUser: async (req, res) => {
        try {
            const userId = req.params.id;
            await userModel.findByIdAndDelete(userId);
            res.status(200).json({ message: "User account deleted by admin successfully" });
        } catch (error) {
            console.error("Error deleting user by admin:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Email verification
    verifyEmail: async (req, res) => {
        try {
            const { token } = req.params;
            const decoded = jwt.verify(token, JWT_SECRET);

            const user = await userModel.findById(decoded.user.id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.isEmailVerified = true;
            await user.save();

            // Emit event for email verification
            const io = getSocketInstance();
            io.emit("user:emailVerified", user.id);

            res.status(200).json({ message: "Email verified successfully" });
        } catch (error) {
            res.status(400).json({ message: "Invalid or expired token" });
        }
    },

    // Resend email verification
    resendVerificationEmail: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await userModel.findOne({ email });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (user.isEmailVerified) {
                return res.status(400).json({ message: "Email already verified" });
            }

            const payload = { user: { id: user.id } };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

            // Send email with verification token
            await sendEmail(user.email, "Verify your email", `Please verify your email by clicking the following link: ${process.env.BASE_URL}/verify-email/${token}`);

            res.status(200).json({ message: "Verification email sent" });
        } catch (error) {
            console.error("Error in resend verification:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Forgot password (send reset email)
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await userModel.findOne({ email });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const resetToken = jwt.sign({ user: { id: user.id } }, JWT_SECRET, { expiresIn: "1h" });

            // Send email with reset token
            await sendEmail(user.email, "Reset your password", `Please reset your password by clicking the following link: ${process.env.BASE_URL}/reset-password/${resetToken}`);

            res.status(200).json({ message: "Password reset email sent" });
        } catch (error) {
            console.error("Error in forgot password:", error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // Reset password
    resetPassword: async (req, res) => {
        try {
            const { token } = req.params;
            const { password } = req.body;

            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await userModel.findById(decoded.user.id);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();

            res.status(200).json({ message: "Password reset successfully" });
        } catch (error) {
            console.error("Error in resetting password:", error);
            res.status(500).json({ message: "Server error" });
        }
    }
};

module.exports = userController;
