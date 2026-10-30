import AppError from '../utils/AppError.js';

/**
 * Authorize Middleware
 * Checks whether the authenticated user has one of the allowed roles.
 * @param {...string} allowedRoles - Roles permitted to access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Unauthorized: Authentication required before authorization check.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access denied. Required role: [${allowedRoles.join(', ')}], your role: [${req.user.role}]`,
          403
        )
      );
    }

    next();
  };
};

export default authorize;

