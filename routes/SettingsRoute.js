const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const { settingsController } = require('../controllers/SettingsController');
const { validateSetting } = require('../validators/settingsValidator');
const { authenticate } = require('../middleware/authentication');
const { authorize } = require('../middleware/authorization');

// Update a setting by key (Admin Only)
router.put('/:key', authenticate, authorize('Admin'), validateSetting, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const updatedSetting = await settingsController.updateSettings(req, res);
    res.status(200).json({ message: 'Setting updated successfully', setting: updatedSetting });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ message: 'Failed to update setting' });
  }
});

// Get all settings (protected route, user only)
router.get('/', authenticate, settingsController.getSettings);

// Get a specific setting by key (protected route, user only)
router.get('/:key', authenticate, settingsController.getSettingByKey);

// Delete setting by key (protected route, admin only)
router.delete('/:key', authenticate, authorize('Admin'), settingsController.deleteSettingByKey);

// Dynamically update a setting (protected route, user only)
router.put('/dynamic', authenticate, settingsController.dynamicSettings);

// Implement multi-language support settings (protected route, user only)
router.post('/multi-language', authenticate, settingsController.multiLanguageSupport);

// Get all settings (Admin Only)
router.get('/', authenticate, authorize('Admin'), settingsController.getSettings);

module.exports = router;