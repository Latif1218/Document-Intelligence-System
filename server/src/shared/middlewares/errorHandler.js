import { ZodError } from 'zod';
import multer from 'multer';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';
import ResponseFormatter from '../utils/responseFormatter.js';

/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Log error with request context
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: err.stack,
  });

  // Zod Schema Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // Multer File Upload Errors
  else if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size limit';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // PostgreSQL Database Errors
  else if (err.code) {
    if (err.code === '23505') {
      statusCode = 409;
      message = 'Duplicate record found';
    }
    else if (err.code === '23503') {
      statusCode = 400;
      message = 'Invalid reference: Foreign key violation';
    }
  }

  return ResponseFormatter.error(res, message, statusCode, errors);
};

export default errorHandler;

