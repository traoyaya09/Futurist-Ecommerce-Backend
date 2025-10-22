// utils/ShippingCostCalculation.js

/**
 * Calculate shipping cost for a single package
 * @param {Object} pkg - Package data
 * @param {number} pkg.weight - Weight of the package in kg
 * @param {Object} pkg.dimensions - Dimensions of the package
 * @param {number} pkg.dimensions.length
 * @param {number} pkg.dimensions.width
 * @param {number} pkg.dimensions.height
 * @param {string} shippingMethod - 'Standard', 'Express', 'Overnight', 'Two-Day'
 * @returns {number} cost
 */
const calculatePackageCost = (pkg, shippingMethod) => {
  const baseRate = 5.0; // Base rate in USD
  const weightFactor = pkg.weight * 0.5; // Cost increases with weight
  const sizeFactor = (pkg.dimensions.length * pkg.dimensions.width * pkg.dimensions.height) / 5000; // Dimensional weight factor

  const methodFactors = {
    Standard: 1.0,
    Express: 1.5,
    Overnight: 2.0,
    'Two-Day': 1.2,
  };

  const methodFactor = methodFactors[shippingMethod] || 1.0;

  return baseRate + weightFactor + sizeFactor * methodFactor;
};

/**
 * Calculate total shipping cost for an order
 * @param {Object} shippingData - Shipping data
 * @param {Array} shippingData.packages - Array of packages
 * @param {string} shippingData.method - Shipping method
 * @param {boolean} shippingData.insurance - Whether insurance is included
 * @param {number} shippingData.insuranceValue - Value to insure
 * @returns {number} total shipping cost
 */
const calculateShippingCost = ({ packages = [], method = 'Standard', insurance = false, insuranceValue = 0 }) => {
  let totalCost = 0;

  for (const pkg of packages) {
    totalCost += calculatePackageCost(pkg, method);
  }

  // Add insurance cost (e.g., 1% of insured value)
  if (insurance && insuranceValue > 0) {
    totalCost += insuranceValue * 0.01;
  }

  // Round to 2 decimal places
  return Math.round(totalCost * 100) / 100;
};

/**
 * Dummy tracking function (could be replaced with real integration)
 */
const trackShipment = async (trackingNumber) => {
  // Example: return dummy tracking status
  return {
    trackingNumber,
    status: 'In Transit',
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
    history: [
      { status: 'Shipped', date: new Date() },
    ],
  };
};

module.exports = {
  calculateShippingCost,
  trackShipment,
};
