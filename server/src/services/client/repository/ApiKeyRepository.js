import BaseRepository from '../../document/repository/BaseRepository.js';


// ApiKeyRepository
class ApiKeyRepository extends BaseRepository {
  constructor() {
    super('api_keys');
  }

  /**
   * Find all API keys belonging to a specific client
   * @param {string} clientId - Client UUID
   * @returns {Promise<Array>}
   */
  async findByClientId(clientId) {
    if (!clientId) return [];
    const sql = `
      SELECT 
        id,
        key_id,
        key_value,
        client_id,
        name,
        description,
        environment,
        is_active,
        permissions,
        security,
        expires_at,
        created_by,
        created_at,
        updated_at
      FROM api_keys
      WHERE client_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await this.query(sql, [clientId]);
    return res.rows;
  }

  /**
   * Find API key by its raw secret key value (with joined client organization)
   * Used by validateApiKey middleware
   * @param {string} keyValue - The secret API key string.
   * @returns {Promise<Object|null>}
   */
  async findByKeyValue(keyValue) {
    if (!keyValue) return null;
    const sql = `
      SELECT 
        k.id,
        k.key_id,
        k.key_value,
        k.client_id,
        k.name,
        k.description,
        k.environment,
        k.is_active,
        k.permissions,
        k.security,
        k.expires_at,
        k.created_at,
        c.id AS client_org_id,
        c.name AS client_name,
        c.slug AS client_slug,
        c.email AS client_email,
        c.is_active AS client_is_active,
        c.settings AS client_settings
      FROM api_keys k
      INNER JOIN clients c ON k.client_id = c.id
      WHERE k.key_value = $1
      LIMIT 1;
    `;
    const res = await this.query(sql, [keyValue.trim()]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];

    // Format into structured object compatible with reference pattern
    const client = {
      id: row.client_org_id,
      _id: row.client_org_id,
      name: row.client_name,
      slug: row.client_slug,
      email: row.client_email,
      isActive: row.client_is_active,
      is_active: row.client_is_active,
      settings: row.client_settings,
    };

    const apiKey = {
      id: row.id,
      _id: row.id,
      keyId: row.key_id,
      keyValue: row.key_value,
      clientId: client,
      name: row.name,
      description: row.description,
      environment: row.environment,
      isActive: row.is_active,
      is_active: row.is_active,
      permissions: row.permissions,
      security: row.security,
      expiresAt: row.expires_at,
      expires_at: row.expires_at,
      createdAt: row.created_at,
      isExpired: () => {
        if (!row.expires_at) return false;
        return new Date(row.expires_at) < new Date();
      },
    };

    return apiKey;
  }

  /**
   * Find API key by public keyId
   * @param {string} keyId - UUID or string key identifier
   */
  async findByKeyId(keyId) {
    if (!keyId) return null;
    const sql = `
      SELECT *
      FROM api_keys
      WHERE key_id = $1
      LIMIT 1;
    `;
    const res = await this.query(sql, [keyId.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Deactivate an API key
   * @param {string} keyId
   */
  async deactivateKey(keyId) {
    const sql = `
      UPDATE api_keys
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE key_id = $1
      RETURNING *;
    `;
    const res = await this.query(sql, [keyId]);
    return res.rows[0] || null;
  }
}

export default ApiKeyRepository;

