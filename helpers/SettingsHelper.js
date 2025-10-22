const Settings = require('../models/SettingsModel');
const crypto = require('crypto');
const { encryptValue, decryptValue } = require('../utils/encryptionHelper'); // Assuming helper functions for encryption and decryption

const settingsHelper = {
    // Update or create a setting with encryption for sensitive values
    updateSettings: async (key, value, isSensitive = false) => {
        try {
            // Encrypt sensitive settings if necessary
            const storedValue = isSensitive ? encryptValue(value) : value;

            let setting = await Settings.findOne({ key });

            if (!setting) {
                // Create a new setting if it doesn't exist
                setting = new Settings({ key, value: storedValue, isSensitive });
            } else {
                // Update the existing setting
                setting.value = storedValue;
                setting.isSensitive = isSensitive;
            }

            await setting.save();
            return setting;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw new Error('Error updating settings');
        }
    },

    // Fetch all settings, with decrypted sensitive values if needed
    getSettings: async () => {
        try {
            const settings = await Settings.find();

            // Decrypt sensitive settings before returning
            const decryptedSettings = settings.map(setting => {
                if (setting.isSensitive) {
                    return { ...setting._doc, value: decryptValue(setting.value) };
                }
                return setting;
            });

            return decryptedSettings;
        } catch (error) {
            console.error('Error fetching settings:', error);
            throw new Error('Error fetching settings');
        }
    },

    // Fetch a specific setting by key, with optional decryption for sensitive data
    getSettingByKey: async (key, decrypt = true) => {
        try {
            const setting = await Settings.findOne({ key });
            if (!setting) throw new Error('Setting not found');

            // Decrypt sensitive value if required
            if (setting.isSensitive && decrypt) {
                setting.value = decryptValue(setting.value);
            }

            return setting;
        } catch (error) {
            console.error('Error fetching setting:', error);
            throw new Error('Error fetching setting');
        }
    },

    // Delete a specific setting by key
    deleteSettingByKey: async (key) => {
        try {
            const result = await Settings.deleteOne({ key });
            if (result.deletedCount === 0) {
                throw new Error('Setting not found');
            }
            return { message: 'Setting deleted successfully' };
        } catch (error) {
            console.error('Error deleting setting:', error);
            throw new Error('Error deleting setting');
        }
    },

    // Batch update settings in bulk
    updateSettingsBulk: async (settingsData) => {
        try {
            const updates = settingsData.map(async (setting) => {
                const storedValue = setting.isSensitive ? encryptValue(setting.value) : setting.value;

                let existingSetting = await Settings.findOne({ key: setting.key });
                if (!existingSetting) {
                    existingSetting = new Settings({ key: setting.key, value: storedValue, isSensitive: setting.isSensitive });
                } else {
                    existingSetting.value = storedValue;
                    existingSetting.isSensitive = setting.isSensitive;
                }

                await existingSetting.save();
                return existingSetting;
            });

            const updatedSettings = await Promise.all(updates);
            return updatedSettings;
        } catch (error) {
            console.error('Error in bulk updating settings:', error);
            throw new Error('Error in bulk updating settings');
        }
    },

    // Retrieve all keys for settings
    getAllSettingKeys: async () => {
        try {
            const keys = await Settings.find().select('key -_id');
            return keys.map(setting => setting.key);
        } catch (error) {
            console.error('Error fetching setting keys:', error);
            throw new Error('Error fetching setting keys');
        }
    }
};

module.exports = settingsHelper;
