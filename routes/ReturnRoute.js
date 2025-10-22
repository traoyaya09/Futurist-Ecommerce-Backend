const express = require('express');
const router = express.Router();
const returnController = require('../controllers/ReturnController');
const { validateReturnRequest, validateReturnProcess } = require('../validators/returnValidator');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Initiate a return (protected route, user only)
router.post('/', authenticate, validateReturnRequest, returnController.requestReturn);

// Process a return (protected route, admin only)
router.put('/:returnId', authenticate, authorize('Admin'), validateReturnProcess, returnController.processReturn);

// Get return status (protected route, user only)
router.get('/:returnId/status', authenticate, returnController.trackReturnStatus);

// Get return history for a user (protected route, user only)
router.get('/user/:userId', authenticate, returnController.returnHistory);

// Get all returns (protected route, admin only)
router.get('/', authenticate, authorize('Admin'), returnController.getAllReturns);

// Get a specific return by ID (protected route, admin or user)
router.get('/:returnId', authenticate, returnController.getReturnById);

// Automated return processing (protected route, admin only)
router.post('/process-automated', authenticate, authorize('Admin'), returnController.automatedReturnProcessing);

module.exports = router;