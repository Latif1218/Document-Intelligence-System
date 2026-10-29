/**
 * AppError - Custom error class for handling application-specific errors with additional context.
 * Used across controllers, services, and middlewares for predictable error propagation.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;

