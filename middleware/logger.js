// middleware/logger.js
const fs = require('fs');
const path = require('path');

function logger(req, res, next) {
  const logFilePath = path.join(__dirname, '..', 'logs', 'access.log');
  const logMessage = `${new Date().toISOString()} - ${req.method} ${req.url}\n`;

  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) console.error(err);
  });

  next();
}

module.exports = logger;