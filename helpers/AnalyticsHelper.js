const Event = require('../models/EventModel');
const AnalyticsData = require('../models/AnalyticsDataModel');
const { validateEventData, validateAnalyticsData } = require('../validators/analyticsValidators'); // Assume validation logic exists

const trackEvent = async (eventData) => {
  try {
    // Validate event data before saving
    const { error } = validateEventData(eventData);
    if (error) throw new Error(`Validation failed: ${error.details[0].message}`);

    // Create a new event and save
    const newEvent = new Event(eventData);
    await newEvent.save();

    console.info(`Event successfully tracked: ${newEvent._id}`);
    return newEvent;

  } catch (error) {
    console.error(`Error tracking event: ${error.message}`, error);
    throw new Error('Error tracking event');
  }
};

const trackAnalyticsData = async (data) => {
  try {
    // Validate analytics data before saving
    const { error } = validateAnalyticsData(data);
    if (error) throw new Error(`Validation failed: ${error.details[0].message}`);

    // Create a new analytics data entry and save
    const newAnalyticsData = new AnalyticsData(data);
    await newAnalyticsData.save();

    console.info(`Analytics data successfully tracked: ${newAnalyticsData._id}`);
    return newAnalyticsData;

  } catch (error) {
    console.error(`Error tracking analytics data: ${error.message}`, error);
    throw new Error('Error tracking analytics data');
  }
};

const batchTrackEvents = async (eventsArray) => {
  try {
    if (!Array.isArray(eventsArray) || eventsArray.length === 0) {
      throw new Error('Invalid input: eventsArray must be a non-empty array');
    }

    const bulkOps = eventsArray.map(eventData => {
      const { error } = validateEventData(eventData);
      if (error) {
        console.warn(`Validation failed for event: ${JSON.stringify(eventData)}, error: ${error.message}`);
        return null;
      }
      return { insertOne: { document: eventData } };
    }).filter(Boolean); // Filter out invalid data

    if (bulkOps.length === 0) {
      throw new Error('No valid events to track');
    }

    const result = await Event.bulkWrite(bulkOps);
    console.info(`Batch event tracking successful: ${result.insertedCount} events tracked`);
    return result;

  } catch (error) {
    console.error(`Error in batch event tracking: ${error.message}`, error);
    throw new Error('Error tracking events in batch');
  }
};

const retrySave = async (saveFunction, retries = 3) => {
  let attempts = 0;
  while (attempts < retries) {
    try {
      return await saveFunction();
    } catch (error) {
      attempts++;
      console.warn(`Save attempt ${attempts} failed: ${error.message}`);
      if (attempts >= retries) {
        throw new Error('Max retry attempts reached');
      }
    }
  }
};

module.exports = { trackEvent, trackAnalyticsData, batchTrackEvents, retrySave };
