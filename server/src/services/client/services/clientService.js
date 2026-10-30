import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import config from '../../../shared/config/index.js';
import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import { APPLICATION_ROLES, isValidClientRole } from '../../../shared/constants/roles.js';


// ClientService
export class ClientService {
  /**
   * @param {Object} dependencies
   * @param {Object} dependencies.clientRepository
   * @param {Object} dependencies.apiKeyRepository
   * @param {Object} dependencies.userRepository
   */
  constructor(dependencies) {
    if (!dependencies) {
      throw new Error('Dependencies are required');
    }
    if (!dependencies.clientRepository) {
      throw new Error('ClientRepository is required');
    }
    if (!dependencies.apiKeyRepository) {
      throw new Error('ApiKeyRepository is required');
    }
    if (!dependencies.userRepository) {
      throw new Error('UserRepository is required');
    }

    this.clientRepository = dependencies.clientRepository;
    this.apiKeyRepository = dependencies.apiKeyRepository;
    this.userRepository = dependencies.userRepository;
  }

  
  // Format user or client object for API response by stripping sensitive fields
  
  formatUserForResponse(user) {
    if (!user) return null;
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password_hash;
    delete userObj.password;
    return userObj;
  }

  /**
   * Generate clean slug from client name
   * @param {string} name - "Acme Corp Ltd" -> "acme-corp-ltd"
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Generate random secure API key with configured prefix
   * @returns {string} - "latif_a8f3b..."
   */
  generateApiKey() {
    const prefix = config.apiKeyConfig?.prefix || 'latif';
    const randomBytes = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${randomBytes}`;
  }

  
  // Check if user has permission to access this client

  canUserAccessClient(user, clientId) {
    if (!user) return false;
    if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
      return true;
    }
    const userClientId = user.clientId || user.client_id;
    return userClientId && userClientId.toString() === clientId.toString();
  }

  /**
   * Create a new Client organization (Super Admin only)
   * Automatically generates initial API key for the newly onboarded client
   * @param {Object} clientData - { name, email, description, website }
   * @param {Object} adminUser - Authenticated Super Admin
   * @returns {Promise<Object>} - Created Client with initialApiKey details
   */
  async createClient(clientData, adminUser) {
    try {
      const { name, email, description = '', website = '' } = clientData;

      if (!name || !email) {
        throw new AppError('Client name and email are required', 400);
      }

      const slug = this.generateSlug(name);
      const existingClient = await this.clientRepository.findBySlug(slug);

      if (existingClient) {
        throw new AppError(`Client with slug "${slug}" already exists`, 400);
      }

      const adminId = adminUser.userId || adminUser.id;

      // Create client in PostgreSQL
      const client = await this.clientRepository.create({
        name: name.trim(),
        slug,
        email: email.toLowerCase().trim(),
        description: description.trim(),
        website: website.trim(),
        created_by: adminId,
        is_active: true,
      });

      // Automatically generate the initial default API key for this client
      const keyId = uuidv4();
      const keyValue = this.generateApiKey();

      const apiKey = await this.apiKeyRepository.create({
        key_id: keyId,
        key_value: keyValue,
        client_id: client.id,
        name: 'Default Ingestion Key',
        description: 'Auto-generated upon client onboarding',
        environment: 'production',
        created_by: adminId,
        is_active: true,
      });

      logger.info('Client onboarded successfully with auto-generated API key', {
        clientId: client.id,
        slug: client.slug,
        keyId: apiKey.key_id,
      });

      return {
        client,
        initialApiKey: {
          id: apiKey.id,
          keyId: apiKey.key_id,
          keyValue: apiKey.key_value, 
          name: apiKey.name,
          environment: apiKey.environment,
          expiresAt: apiKey.expires_at,
        },
      };
    } catch (error) {
      logger.error('Error creating client:', error);
      throw error;
    }
  }

  
  // List clients visible to current authenticated user
  async listClients(user) {
    try {
      if (user.role === APPLICATION_ROLES.SUPER_ADMIN) {
        return await this.clientRepository.findAll();
      }

      const clientId = user.clientId || user.client_id;
      if (!clientId) return [];

      const ownClient = await this.clientRepository.findById(clientId);
      return ownClient ? [ownClient] : [];
    } catch (error) {
      logger.error('Error listing clients:', error);
      throw error;
    }
  }

  
  // Create a new Client User (client_admin or client_viewer)

  async createClientUser(clientId, userData, adminUser) {
    try {
      if (!this.canUserAccessClient(adminUser, clientId)) {
        throw new AppError('Access denied: You cannot manage users for this client', 403);
      }

      const {
        username,
        name,
        email,
        password,
        role = APPLICATION_ROLES.CLIENT_VIEWER,
      } = userData;

      if (!isValidClientRole(role)) {
        throw new AppError('Invalid role. Role must be client_admin or client_viewer', 400);
      }

      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw new AppError('Client not found', 404);
      }

      if (!client.is_active) {
        throw new AppError('Cannot create users for a deactivated client', 400);
      }

      // Check username or email duplication
      const existingUser = await this.userRepository.findByUsername(username);
      if (existingUser) {
        throw new AppError('Username already exists', 409);
      }

      const existingEmail = await this.userRepository.findByEmail(email);
      if (existingEmail) {
        throw new AppError('Email already exists', 409);
      }

      // Role-specific granular permissions
      let permissions = {
        canCreateApiKeys: false,
        canManageUsers: false,
        canViewAnalytics: true,
        canExportData: false,
      };

      if (role === APPLICATION_ROLES.CLIENT_ADMIN) {
        permissions = {
          canCreateApiKeys: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canExportData: true,
        };
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
        permissions,
      });

      logger.info('Client user created successfully', {
        clientId,
        userId: user.id,
        role,
      });

      return this.formatUserForResponse(user);
    } catch (error) {
      logger.error('Error creating client user:', error);
      throw error;
    }
  }

  
  // Create an additional API Key for a specific client

  async createApiKey(clientId, keyData, user) {
    try {
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw new AppError('Client not found', 404);
      }

      if (!this.canUserAccessClient(user, clientId)) {
        throw new AppError('Access denied', 403);
      }

      if (
        user.role !== APPLICATION_ROLES.SUPER_ADMIN &&
        user.role !== APPLICATION_ROLES.CLIENT_ADMIN
      ) {
        throw new AppError('Access denied: Only Super Admin and Client Admin can create API keys', 403);
      }

      const {
        name,
        description = '',
        environment = 'production',
        permissions = { canIngest: true, canReadAnalytics: true },
      } = keyData;

      if (!name) {
        throw new AppError('API Key name is required', 400);
      }

      const keyId = uuidv4();
      const keyValue = this.generateApiKey();
      const adminId = user.userId || user.id;

      const apiKey = await this.apiKeyRepository.create({
        key_id: keyId,
        key_value: keyValue,
        client_id: clientId,
        name: name.trim(),
        description: description.trim(),
        environment,
        permissions,
        created_by: adminId,
        is_active: true,
      });

      logger.info('New API key created for client', {
        clientId,
        keyId: apiKey.key_id,
        name: apiKey.name,
      });

      return apiKey;
    } catch (error) {
      logger.error('Error creating API key:', error);
      throw error;
    }
  }

  
  // Get all API keys for a specific client (Sensitive keyValue is masked for security)

  async getClientApiKeys(clientId, user) {
    try {
      if (!this.canUserAccessClient(user, clientId)) {
        throw new AppError('Access denied: Cannot view API keys for this client', 403);
      }

      const apiKeys = await this.apiKeyRepository.findByClientId(clientId);

      // Mask keyValue 
      return apiKeys.map((key) => {
        const keyObj = { ...key };
        if (keyObj.key_value) {
          const val = keyObj.key_value;
          keyObj.maskedKey = val.substring(0, 12) + '...' + val.substring(val.length - 4);
          delete keyObj.key_value;
        }
        return keyObj;
      });
    } catch (error) {
      logger.error('Error fetching client API keys:', error);
      throw error;
    }
  }

  
  // Validate API key and retrieve client organization
  async getClientByApiKey(apiKey) {
    try {
      const keyObj = await this.apiKeyRepository.findByKeyValue(apiKey);
      if (!keyObj) return null;

      if (keyObj.isExpired && keyObj.isExpired()) {
        return null;
      }

      return {
        client: keyObj.clientId,
        apiKey: keyObj,
      };
    } catch (error) {
      logger.error('Error finding client by API key:', error);
      throw error;
    }
  }
}

export default ClientService;

