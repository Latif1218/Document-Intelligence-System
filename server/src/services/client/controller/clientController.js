import ResponseFormatter from '../../../shared/utils/responseFormatter.js';

export class ClientController {
  /**
   * @param {Object} clientService
   * @param {Object} authService
   */
  constructor(clientService, authService) {
    if (!clientService) {
      throw new Error('ClientService is required');
    }
    if (!authService) {
      throw new Error('AuthService is required');
    }

    this.clientService = clientService;
    this.authService = authService;

    // Bind methods
    this.listClients = this.listClients.bind(this);
    this.createClient = this.createClient.bind(this);
    this.createClientUser = this.createClientUser.bind(this);
    this.createApiKey = this.createApiKey.bind(this);
    this.getClientApiKeys = this.getClientApiKeys.bind(this);
  }

  
  // Lists clients visible to current authenticated user
  
  async listClients(req, res, next) {
    try {
      const clients = await this.clientService.listClients(req.user);
      return ResponseFormatter.success(res, clients, 'Clients fetched successfully', 200);
    } catch (error) {
      next(error);
    }
  }


  // Onboards a new client and automatically issues default API key (Super Admin only)
  
  async createClient(req, res, next) {
    try {
      const userId = req.user.userId || req.user.id;
      const isSuperAdmin = await this.authService.checkSuperAdminPermissions(userId);

      if (!isSuperAdmin) {
        return ResponseFormatter.error(res, 'Access denied: Only Super Admin can onboard clients', 403);
      }

      const result = await this.clientService.createClient(req.body, req.user);
      return ResponseFormatter.success(res, result, 'Client created successfully', 201);
    } catch (error) {
      next(error);
    }
  }


  // Creates a user under a client (role: client_admin or client_viewer)
  
  async createClientUser(req, res, next) {
    try {
      const { clientId } = req.params;
      const user = await this.clientService.createClientUser(clientId, req.body, req.user);
      return ResponseFormatter.success(res, user, 'Client user created successfully', 201);
    } catch (error) {
      next(error);
    }
  }


  // Creates an additional API Key for a client

  async createApiKey(req, res, next) {
    try {
      const { clientId } = req.params;
      const apiKey = await this.clientService.createApiKey(clientId, req.body, req.user);
      return ResponseFormatter.success(res, apiKey, 'API key created successfully', 201);
    } catch (error) {
      next(error);
    }
  }


  // Gets all API keys for a client with masked secrets
  
  async getClientApiKeys(req, res, next) {
    try {
      const { clientId } = req.params;
      const apiKeys = await this.clientService.getClientApiKeys(clientId, req.user);
      return ResponseFormatter.success(res, apiKeys, 'API keys fetched successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export default ClientController;

