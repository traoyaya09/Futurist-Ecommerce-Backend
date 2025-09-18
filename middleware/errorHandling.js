const winston = require('winston');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' }),
    new winston.transports.Console(),
  ],
});

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
