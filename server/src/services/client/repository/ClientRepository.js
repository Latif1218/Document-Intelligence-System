import BaseRepository from '../../document/repository/BaseRepository.js';


// ClientRepository
class ClientRepository extends BaseRepository {
  constructor() {
    super('clients');
  }

  /**
   * Find a client by unique slug
   * @param {string} slug - Unique organization slug 
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug) {
    if (!slug) return null;
    const sql = `
      SELECT *
      FROM clients
      WHERE LOWER(slug) = LOWER($1)
      LIMIT 1;
    `;
    const res = await this.query(sql, [slug.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Find all clients (Super Admin view)
   * Compatible with reference repo: await this.clientRepository.find({}, { limit: 200 })
   * @param {Object} filter - Optional filter conditions
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>}
   */
  async find(filter = {}, options = { limit: 200, offset: 0 }) {
    const limit = options.limit || 200;
    const offset = options.offset || 0;

    const sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count,
        (SELECT COUNT(*) FROM api_keys k WHERE k.client_id = c.id AND k.is_active = TRUE) AS active_key_count
      FROM clients c
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const res = await this.query(sql, [limit, offset]);
    return res.rows;
  }

  // Alias for find
  async findAll(options) {
    return this.find({}, options);
  }

  /**
   * Update client active state
   * @param {string} id - Client UUID
   * @param {boolean} isActive
   */
  async updateActiveStatus(id, isActive) {
    const sql = `
      UPDATE clients
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const res = await this.query(sql, [isActive, id]);
    return res.rows[0] || null;
  }
}

export default ClientRepository;

