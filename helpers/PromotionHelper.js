const dayjs = require('dayjs');

/**
 * Check if a promotion is currently active.
 * @param {Date} startDate - Start date of the promotion.
 * @param {Date} endDate - End date of the promotion.
 * @returns {Boolean} - Returns true if the promotion is active, false otherwise.
 */
const isPromotionActive = (startDate, endDate) => {
  const now = dayjs();
  return now.isAfter(dayjs(startDate)) && now.isBefore(dayjs(endDate));
};

/**
 * Generate a unique banner identifier for promotions.
 * @param {String} title - Title of the promotion.
 * @returns {String} - A slugified identifier based on the title and current timestamp.
 */
const generateBannerIdentifier = (title) => {
  const timestamp = Date.now();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${timestamp}`;
};

/**
 * Format promotion data for frontend use.
 * @param {Object} promotion - The promotion object from the database.
 * @returns {Object} - Formatted promotion data.
 */
const formatPromotionForFrontend = (promotion) => ({
  id: promotion._id,
  title: promotion.title,
  description: promotion.description,
  image: promotion.image,
  alt: promotion.alt,
  isActive: isPromotionActive(promotion.startDate, promotion.endDate),
  priority: promotion.priority,
});

/**
 * Sort promotions by priority and active status.
 * @param {Array} promotions - Array of promotion objects.
 * @returns {Array} - Sorted promotions array.
 */
const sortPromotions = (promotions) => {
  return promotions.sort((a, b) => {
    // Active promotions first, then by priority in descending order
    const isActiveA = isPromotionActive(a.startDate, a.endDate) ? 1 : 0;
    const isActiveB = isPromotionActive(b.startDate, b.endDate) ? 1 : 0;

    if (isActiveA !== isActiveB) {
      return isActiveB - isActiveA;
    }
    return b.priority - a.priority; // Higher priority first
  });
};

module.exports = {
  isPromotionActive,
  generateBannerIdentifier,
  formatPromotionForFrontend,
  sortPromotions,
};
