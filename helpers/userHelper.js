const User = require('../models/UserModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const userHelper = {
    // Create a new user with password hashing
    createUser: async (userData) => {
        try {
            const { name, email, password } = userData;

            // Check if email is already taken
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw new Error('User already exists');
            }

            // Hash the user's password before saving
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new User({
                name,
                email,
                password: hashedPassword
            });

            await newUser.save();
            return newUser;
        } catch (error) {
            console.log('Error creating user:', error);
            throw new Error('Error creating user');
        }
    },

    // Update user details with optional password change
    updateUser: async (userId, newData) => {
        try {
            const { name, email, password } = newData;
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            user.name = name || user.name;
            user.email = email || user.email;

            if (password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
            }

            await user.save();
            return user;
        } catch (error) {
            console.log('Error updating user:', error);
            throw new Error('Error updating user');
        }
    },

    // Delete user by ID
    deleteUser: async (userId) => {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            await User.findByIdAndDelete(userId);
            return { message: 'User deleted successfully' };
        } catch (error) {
            console.log('Error deleting user:', error);
            throw new Error('Error deleting user');
        }
    },

    // Generate JWT token for authentication
    generateAuthToken: async (user) => {
        try {
            const payload = { user: { id: user._id } };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

            return token;
        } catch (error) {
            console.log('Error generating token:', error);
            throw new Error('Error generating token');
        }
    },

    // Validate password during login or update
    validatePassword: async (password, hashedPassword) => {
        try {
            const isMatch = await bcrypt.compare(password, hashedPassword);
            if (!isMatch) {
                throw new Error('Invalid credentials');
            }
            return true;
        } catch (error) {
            console.log('Error validating password:', error);
            throw new Error('Error validating password');
        }
    }
};

module.exports = userHelper;
