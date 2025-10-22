// services/index.js

const { generateInvoice } = require('./services/invoiceService');
const { generateShippingLabel } = require('./services/ShippingService');
const { trackOrder } = require('./services/OrderService');
const { sendNotification } = require('./services/NotificationService');
const { generateReport } = require('./services/reportService');
const { sendEmail } = require('./services/EmailService');

module.exports = {
    generateInvoice,
    generateShippingLabel,
    trackOrder,
    sendNotification,
    generateReport,
    sendEmail,
};
