import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import postgres from '../config/postgres.js';
import logger from '../config/logger.js';
import ResponseFormatter from '../utils/responseFormatter.js';
import AppError from '../utils/AppError.js';

/**
 * Authentication Middleware
 * 1. Checks req.cookies.authToken 
 * 2. Checks req.cookies.token
 * 3. Checks Authorization: Bearer <token>
 * 4. Checks ?token=... (For SSE stream connections)
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Extract from Cookies
    if (req.cookies && (req.cookies.authToken || req.cookies.token)) {
      token = req.cookies.authToken || req.cookies.token;
    }
    // Extract from Authorization Header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Extract from Query Param (browser EventSource SSE)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return ResponseFormatter.error(res, 'Authentication token is required. Please log in.', 401);
    }

    // Verify token validity
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      logger.error('Authentication token verification failed', {
        error: err.message,
        path: req.path,
      });

      if (err.name === 'TokenExpiredError') {
        return ResponseFormatter.error(res, 'Token expired. Please log in again.', 401);
      }
      return ResponseFormatter.error(res, 'Invalid token. Please log in again.', 401);
    }

    const userId = decoded.userId || decoded.id;

    // Fetch user from PostgreSQL to ensure account is active and obtain up-to-date role & clientId
    const userSql = `
      SELECT id, username, name, email, role, client_id, is_active, permissions
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const userResult = await postgres.query(userSql, [userId]);
    const user = userResult.rows[0];

    if (!user) {
      return ResponseFormatter.error(res, 'User belonging to this session no longer exists.', 401);
    }

    if (!user.is_active) {
      return ResponseFormatter.error(res, 'Account is deactivated. Please contact support.', 403);
    }

    // Attach structured user profile to request context
    req.user = {
      userId: user.id,
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.client_id,
      client_id: user.client_id,
      permissions: user.permissions,
    };

    next();
  } catch (error) {
    logger.error('Error during authentication middleware execution:', error);
    return ResponseFormatter.error(res, 'Internal server error during authentication', 500);
  }
};

export default authenticate;
