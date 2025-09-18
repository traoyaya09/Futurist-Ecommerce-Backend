const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const userController = require('../controllers/UserController');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Register user (Public Route)
router.post('/register', [
  check('name', 'Name is required').notEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
], userController.register);

// Login user (Public Route)
router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists(),
], userController.login);

// Get user profile (Protected Route)
router.get('/profile', authenticate, userController.getUserProfile);

// Update user profile (Protected Route)
router.put('/profile', authenticate, [
  check('email', 'Please include a valid email').optional().isEmail(),
  check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 }),
], userController.updateUserProfile);

// Delete user (Protected Route)
router.delete('/profile', authenticate, userController.deleteUser);

// **Fetch all users (Admin only)**
router.get('/', authenticate, authorize('Admin'), userController.getAllUsers);

// **Fetch single user by ID (if needed)**
router.get('/:userId', authenticate, authorize('Admin'), userController.getUserById);

module.exports = router;
