/**
 * ResponseFormatter - Standardized JSON API Response Helper
 */


class ResponseFormatter {
  /**
   * Format a successful HTTP response
   * @param {Object} res - Express response object
   * @param {*} data - Payload data
   * @param {string} message - Human-readable success message
   * @param {number} statusCode - HTTP status code (default: 200)
   * @param {Object} meta - Optional pagination or metadata
   */
  static success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
    const response = {
      success: true,
      message,
      data
    };

    if (meta) {
      response.meta = meta;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Format an error HTTP response
   * @param {Object} res - Express response object
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {*} errors - Validation errors or extra context
   */
  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      ...(errors && { errors })
    };

    return res.status(statusCode).json(response);
  }
}

export default ResponseFormatter;

