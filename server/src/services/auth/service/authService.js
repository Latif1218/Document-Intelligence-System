import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../../shared/config/index.js';
import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import { APPLICATION_ROLES, isValidRole } from '../../../shared/constants/roles.js';


// AuthService
class AuthService {
  constructor(userRepository) {
    if (!userRepository) {
      throw new Error('UserRepository is required');
    }
    this.userRepository = userRepository;
  }

  /**
   * Generates a signed JWT access token containing userId, username, email, role, and clientId
   * @param {Object} user - User entity
   * @returns {string} - Signed JWT token
   */
  generateToken(user) {
    const userId = user.id || user._id;
    const clientId = user.client_id || user.clientId || null;

    const payload = {
      userId,
      id: userId,
      username: user.username,
      email: user.email,
      role: user.role,
      clientId,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Formats user object for API responses by omitting password hashes
   * @param {Object} user - User entity
   * @returns {Object}
   */
  formatUserForResponse(user) {
    if (!user) return null;
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password_hash;
    delete userObj.password;
    return userObj;
  }

  /**
   * Compares user-entered plain text password with hashed password
   * @param {string} userEnteredPassword
   * @param {string} hashedPassword
   * @returns {Promise<boolean>}
   */
  async comparePassword(userEnteredPassword, hashedPassword) {
    if (!userEnteredPassword || !hashedPassword) return false;
    return await bcrypt.compare(userEnteredPassword, hashedPassword);
  }

  /**
   * Onboards the first Super Admin user.
   * Allowed ONLY ONCE when total user count is 0.
   * Matches reference repository endpoint behavior.
   * @param {Object} superAdminData - { username, name, email, password }
   * @returns {Promise<{ user: Object, token: string }>}
   */
  async onboardSuperAdmin(superAdminData) {
    try {
      // Verify if any user exists in database
      const count = await this.userRepository.countAll();
      if (count > 0) {
        throw new AppError('Super admin onboarding is disabled', 403);
      }

      const { username, name, email, password } = superAdminData;

      if (!username || !email || !password) {
        throw new AppError('Username, email, and password are required', 400);
      }

      // Hash password with bcrypt 
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Persist Super Admin record
      const user = await this.userRepository.createUser({
        username: username.toLowerCase().trim(),
        name: name ? name.trim() : username.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: APPLICATION_ROLES.SUPER_ADMIN,
        clientId: null,
        permissions: {
          canCreateApiKeys: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canExportData: true,
        },
      });

      // Generate JWT auth token
      const token = this.generateToken(user);

      logger.info('Super Admin onboarded successfully', {
        id: user.id,
        username: user.username,
        email: user.email,
      });

      return {
        user: this.formatUserForResponse(user),
        token,
      };
    } catch (error) {
      logger.error('Error during Super Admin onboarding:', error);
      throw error;
    }
  }

  /**
   * Register a new user (default role: client_viewer)
   * Note: Client Admins should normally be created via ClientService
   */
  async register(userData) {
    try {
      const { username, name, email, password, role = APPLICATION_ROLES.CLIENT_VIEWER, clientId = null } = userData;

      if (!username || !email || !password) {
        throw new AppError('Username, email, and password are required', 400);
      }

      const existingUser = await this.userRepository.findByUsername(username);
      if (existingUser) {
        throw new AppError('Username already exists', 409);
      }

      const existingEmail = await this.userRepository.findByEmail(email);
      if (existingEmail) {
        throw new AppError('Email already exists', 409);
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await this.userRepository.createUser({
        username,
        name: name || username,
        email,
        passwordHash,
        role,
        clientId,
      });

      const token = this.generateToken(user);

      logger.info('User registered successfully', { username: user.username });

      return {
        user: this.formatUserForResponse(user),
        token,
      };
    } catch (error) {
      logger.error('Error in user registration:', error);
      throw error;
    }
  }


  // Authenticate user with flexible credentials (username OR email, and password)

  async login(credentials, plainPassword = null) {
    try {
      let identifier;
      let password;

      if (typeof credentials === 'object' && credentials !== null) {
        identifier = credentials.username || credentials.email || credentials.identifier;
        password = credentials.password;
      } else {
        identifier = credentials;
        password = plainPassword;
      }

      if (!identifier || !password) {
        throw new AppError('Username or email and password are required', 400);
      }

      const user = await this.userRepository.findByUsernameOrEmail(identifier);
      if (!user) {
        throw new AppError('Invalid credentials', 401);
      }

      if (!user.is_active) {
        throw new AppError('Account is deactivated', 403);
      }

      const isPasswordValid = await this.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401);
      }

      const token = this.generateToken(user);

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      return {
        user: this.formatUserForResponse(user),
        token,
      };
    } catch (error) {
      logger.error('Error in user login:', error);
      throw error;
    }
  }

  
  //  Fetch current user profile with client organization metadata
  
  async getProfile(userId) {
    try {
      const user = await this.userRepository.findProfileById(userId);
      if (!user) {
        throw new AppError('User profile not found', 404);
      }
      return this.formatUserForResponse(user);
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      throw error;
    }
  }

  
  //  Check if a given user has Super Admin authority
  
  async checkSuperAdminPermissions(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) return false;
      return user.role === APPLICATION_ROLES.SUPER_ADMIN;
    } catch (error) {
      logger.error('Error checking Super Admin permissions:', error);
      return false;
    }
  }

  
  // List users with pagination and filters
  
  async listUsers(query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const data = await this.userRepository.listUsers({
      role: query.role,
      clientId: query.clientId,
      limit,
      offset,
    });

    return {
      ...data,
      page,
      totalPages: Math.ceil(data.total / limit),
    };
  }

  
  // Update role of a user
  
  async updateUserRole(userId, newRole) {
    if (!isValidRole(newRole)) {
      throw new AppError(`Invalid role: ${newRole}`, 400);
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('Target user not found', 404);
    }

    const updatedUser = await this.userRepository.updateRole(userId, newRole);
    return this.formatUserForResponse(updatedUser);
  }
}

export default AuthService;
