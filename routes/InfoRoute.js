const express = require('express');
const router = express.Router();
const infoController = require('../controllers/InfoController');
const { validateInfoData, validateIdParam } = require('../middleware/validation');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// GET all info entries (Public Route)
router.get('/', async (req, res, next) => {
  try {
    await infoController.getAllInfo(req, res);
  } catch (error) {
    next(error);
  }
});

// GET info entry by ID (Public Route)
router.get('/:id', validateIdParam, async (req, res, next) => {
  try {
    await infoController.getInfoById(req, res);
  } catch (error) {
    next(error);
  }
});

// POST create a new info entry (Admin Only)
router.post('/', authenticate, authorize('Admin'), validateInfoData, async (req, res, next) => {
  try {
    await infoController.createInfo(req, res);
  } catch (error) {
    next(error);
  }
});

// PUT update an info entry by ID (Admin Only)
router.put('/:id', authenticate, authorize('Admin'), validateIdParam, validateInfoData, async (req, res, next) => {
  try {
    await infoController.updateInfo(req, res);
  } catch (error) {
    next(error);
  }
});

// DELETE an info entry by ID (Admin Only)
router.delete('/:id', authenticate, authorize('Admin'), validateIdParam, async (req, res, next) => {
  try {
    await infoController.deleteInfo(req, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;