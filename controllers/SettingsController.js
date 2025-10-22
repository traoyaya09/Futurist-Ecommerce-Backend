const Settings = require('../models/SettingsModel');
const { validationResult } = require('express-validator');
const { decryptValue, encryptValue } = require('../utils/encryption'); // Encryption helpers
const { getSocketInstance } = require('../socket');

const settingsController = {
  // Update or create new settings with encryption for sensitive values
  updateSettings: async (req, res) => {
    try {
      const { key, value, isSensitive } = req.body;

      // Conditionally encrypt sensitive data (API keys, passwords, etc.)
      const storedValue = isSensitive ? encryptValue(value) : value;

      // Check if the setting already exists, then update or create a new one
      let setting = await Settings.findOne({ key });
      if (!setting) {
        setting = new Settings({ key, value: storedValue });
      } else {
        setting.value = storedValue;
      }

      await setting.save();

      // Emit socket event for settings update
      const io = getSocketInstance();
      io.emit('settings:updated', setting);

      return res.status(200).json({ message: 'Settings updated successfully', setting });
    } catch (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ message: 'Internal server error during settings update' });
    }
  },

  // Get all settings, with decrypted sensitive values where necessary
  getSettings: async (req, res) => {
    try {
      const settings = await Settings.find();

      // Decrypt sensitive settings before sending them in response
      const decryptedSettings = settings.map(setting => {
        if (setting.isSensitive) {
          return { ...setting._doc, value: decryptValue(setting.value) };
        }
        return setting;
      });

      return res.status(200).json({ settings: decryptedSettings });
    } catch (error) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ message: 'Internal server error during settings retrieval' });
    }
  },

  // Get a specific setting by its key
  getSettingByKey: async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await Settings.findOne({ key });

      if (!setting) {
        return res.status(404).json({ message: `Setting with key '${key}' not found` });
      }

      // Decrypt sensitive settings
      if (setting.isSensitive) {
        setting.value = decryptValue(setting.value);
      }

      return res.status(200).json(setting);
    } catch (error) {
      console.error('Error fetching setting by key:', error);
      return res.status(500).json({ message: 'Internal server error during setting retrieval' });
    }
  },

  // Delete setting by key
  deleteSettingByKey: async (req, res) => {
    try {
      const { key } = req.params;
      const deletedSetting = await Settings.findOneAndDelete({ key });

      if (!deletedSetting) {
        return res.status(404).json({ message: `Setting with key '${key}' not found` });
      }

      // Emit socket event for settings deletion
      const io = getSocketInstance();
      io.emit('settings:deleted', key);

      return res.status(200).json({ message: `Setting with key '${key}' deleted successfully` });
    } catch (error) {
      console.error('Error deleting setting:', error);
      return res.status(500).json({ message: 'Failed to delete setting' });
    }
  },

  // Implement dynamic settings update
  dynamicSettings: async (req, res) => {
    try {
      const { key, newValue } = req.body;

      // Dynamically update a setting in real-time (without restart)
      const setting = await Settings.findOneAndUpdate({ key }, { value: newValue }, { new: true });

      if (!setting) {
        return res.status(404).json({ message: 'Setting not found' });
      }

      // Emit socket event for dynamic settings update
      const io = getSocketInstance();
      io.emit('settings:dynamic', setting);

      return res.status(200).json({ message: 'Dynamic settings updated successfully', setting });
    } catch (error) {
      console.error('Error updating dynamic settings:', error);
      return res.status(500).json({ message: 'Error updating dynamic settings' });
    }
  },

  // Implement multi-language support settings
  multiLanguageSupport: async (req, res) => {
    try {
      const { language } = req.body;

      // Implement multi-language support logic, e.g., setting language preferences
      const languageSetting = await Settings.findOneAndUpdate(
        { key: 'language' }, 
        { value: language }, 
        { new: true, upsert: true }
      );

      // Emit socket event for multi-language support update
      const io = getSocketInstance();
      io.emit('settings:multiLanguage', languageSetting);

      return res.status(200).json({ message: 'Language settings updated successfully', languageSetting });
    } catch (error) {
      console.error('Error implementing multi-language support:', error);
      return res.status(500).json({ message: 'Error implementing multi-language support' });
    }
  },
};

// Role-based access control middleware
const roleBasedAccessControl = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const userRole = req.user.role;

            // Check if the user's role is allowed to access the resource
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }

            next();
        } catch (error) {
            console.error('Role-based access control error:', error);
            res.status(500).json({ message: 'Internal server error during role validation' });
        }
    };
};

module.exports = { settingsController, roleBasedAccessControl };
