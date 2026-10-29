import logger from '../config/logger.js';

/**
 * HTTP Request Logging Middleware
 * Tracks incoming requests, response status codes, and execution duration.
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      logger.error(logMessage, { ip, method, originalUrl, statusCode, duration });
    } else if (statusCode >= 400) {
      logger.warn(logMessage, { ip, method, originalUrl, statusCode, duration });
    } else {
      logger.info(logMessage, { ip, method, originalUrl, statusCode, duration });
    }
  });

  next();
};

export default requestLogger;

