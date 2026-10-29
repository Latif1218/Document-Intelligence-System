import winston from 'winston';
import config from './index.js';

/**
 * Winston Logger Setup
 */
const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for terminal readability in development
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
});

const logger = winston.createLogger({
  level: config.app.isProduction ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    config.app.isProduction ? json() : combine(colorize(), consoleFormat)
  ),
  transports: [
    new winston.transports.Console(),
  ],
  exitOnError: false,
});

export default logger;

