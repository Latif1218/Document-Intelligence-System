import ResponseFormatter from '../../../shared/utils/responseFormatter.js';
import config from '../../../shared/config/index.js';
import { APPLICATION_ROLES } from '../../../shared/constants/roles.js';


const cookieOptions = {
  httpOnly: config.cookie.httpOnly,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  maxAge: config.cookie.expiresIn,
};

class AuthController {
  constructor(authService) {
    if (!authService) {
      throw new Error('AuthService is required');
    }
    this.authService = authService;

    // Bind execution context
    this.onboardSuperAdmin = this.onboardSuperAdmin.bind(this);
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.getMe = this.getMe.bind(this);
    this.listUsers = this.listUsers.bind(this);
    this.updateRole = this.updateRole.bind(this);
  }

  /**
   * Helper to set authentication cookie on response
   * Sets 'authToken' and 'token'
   */
  setAuthCookie(res, token) {
    res.cookie('authToken', token, cookieOptions);
    res.cookie('token', token, cookieOptions);
  }

  // Helper to clear authentication cookies on response
   
  clearAuthCookie(res) {
    res.clearCookie('authToken');
    res.clearCookie('token');
  }

  /**
   * Initial one-time Super Admin onboarding.
   * Allowed ONLY if total user count in system is 0.
   */
  async onboardSuperAdmin(req, res, next) {
    try {
      const { username, name, email, password } = req.body;
      const superAdminData = {
        username,
        name,
        email,
        password,
        role: APPLICATION_ROLES.SUPER_ADMIN,
      };

      const { user, token } = await this.authService.onboardSuperAdmin(superAdminData);

      // Set HTTP-only Cookie
      this.setAuthCookie(res, token);

      return ResponseFormatter.success(
        res,
        { user, token },
        'Super admin created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  
  // Registers a new client viewer user

  async register(req, res, next) {
    try {
      const { user, token } = await this.authService.register(req.body);
      this.setAuthCookie(res, token);

      return ResponseFormatter.success(
        res,
        { user, token },
        'User created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  
  // Authenticates user with username or email + password and sets auth cookie
  
  async login(req, res, next) {
    try {
      const { user, token } = await this.authService.login(req.body);
      this.setAuthCookie(res, token);

      return ResponseFormatter.success(
        res,
        { user, token },
        'User logged in successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }


  // Clears HTTP-only auth cookies

  async logout(req, res, next) {
    try {
      this.clearAuthCookie(res);
      return ResponseFormatter.success(res, {}, 'Logout successful', 200);
    } catch (error) {
      next(error);
    }
  }

  
  // Fetches the current logged in user's profile and client metadata
  
  async getMe(req, res, next) {
    try {
      const userId = req.user.userId || req.user.id;
      const profile = await this.authService.getProfile(userId);

      return ResponseFormatter.success(res, profile, 'Profile fetched successfully', 200);
    } catch (error) {
      next(error);
    }
  }

   
  // Lists users (Super Admin or Client Admin)
  
  async listUsers(req, res, next) {
    try {
      const query = { ...req.query };

      // If user is client_admin, restrict to their own clientId
      if (req.user.role === APPLICATION_ROLES.CLIENT_ADMIN) {
        query.clientId = req.user.clientId;
      }

      const result = await this.authService.listUsers(query);
      return ResponseFormatter.success(res, result.users, 'Users list retrieved', 200, {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
      });
    } catch (error) {
      next(error);
    }
  }

  
  // Updates user role (Super Admin only)

  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const updatedUser = await this.authService.updateUserRole(id, role);

      return ResponseFormatter.success(res, updatedUser, `User role updated to ${role} successfully`, 200);
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
