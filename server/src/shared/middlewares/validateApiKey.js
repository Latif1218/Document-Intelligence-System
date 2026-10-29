// API KEY VALIDATION MIDDLEWARE
// Validates 'x-api-key' against PostgreSQL api_keys & clients tables


import config from '../config/index.js';
import logger from '../config/logger.js';
import ResponseFormatter from '../utils/responseFormatter.js';
import { clientService } from '../../services/client/Dependencies/dependencies.js';

/**
 * Validates external API keys for service-to-service communication & document upload.
 * 1. Checks 'x-api-key' header, query string, or Bearer token.
 * 2. Checks against system master key (for admin automation/CLI).
 * 3. Checks against PostgreSQL api_keys table via clientService.
 * 4. Injects req.client, req.clientId, and req.apiKey into request context.
 */
const validateApiKey = async (req, res, next) => {
  try {
    // Allow health check endpoint to bypass authentication
    if (req.path === '/health' || req.path === '/api/health') {
      return next();
    }

    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];
    const bearerKey = authHeader && authHeader.startsWith('ApiKey ') ? authHeader.split(' ')[1] : null;
    const queryKey = req.query.apiKey;

    const providedKey = apiKeyHeader || bearerKey || queryKey;

    if (!providedKey) {
      logger.warn('Request attempted without API Key', {
        path: req.path,
        ip: req.ip,
      });
      return ResponseFormatter.error(res, 'API key is required (header: x-api-key)', 401);
    }

    // Check for Platform Master API Key
    if (providedKey === config.app.apiKey) {
      req.client = {
        id: null,
        name: 'Platform Master System',
        slug: 'platform-master',
        is_active: true,
      };
      req.clientId = null;
      req.apiKey = { keyId: 'master', name: 'Master System Key' };
      return next();
    }

    // Query Client & API Key from PostgreSQL via clientService
    const result = await clientService.getClientByApiKey(providedKey);

    if (!result) {
      logger.warn('Invalid or expired API Key attempted', {
        path: req.path,
        ip: req.ip,
        keySample: providedKey.substring(0, 10) + '...',
      });
      return ResponseFormatter.error(res, 'Invalid or expired API key', 403);
    }

    const { client, apiKey } = result;

    // Check if client organization is active
    if (!client.is_active && !client.isActive) {
      logger.warn('Inactive client attempted API access', {
        clientId: client.id,
        path: req.path,
      });
      return ResponseFormatter.error(res, 'Client account is inactive. Please contact support.', 403);
    }

    // Check if API key itself is active
    if (!apiKey.is_active && !apiKey.isActive) {
      return ResponseFormatter.error(res, 'This API key has been revoked/deactivated', 403);
    }

    // Check permissions
    if (apiKey.permissions && apiKey.permissions.canIngest === false) {
      return ResponseFormatter.error(res, 'API key does not have document ingestion permissions', 403);
    }

    // Attach validated tenant context to request
    req.client = client;
    req.clientId = client.id || client._id;
    req.apiKey = apiKey;

    next();
  } catch (error) {
    logger.error('Error validating API key:', error);
    return ResponseFormatter.error(res, 'Internal server error validating API key', 500);
  }
};

export default validateApiKey;
