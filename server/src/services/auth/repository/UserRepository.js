import BaseRepository from '../../document/repository/BaseRepository.js';


// UserRepository

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Count total registered users in system
   * Used for one-time super admin onboarding verification (allowed only when total === 0)
   * @returns {Promise<number>}
   */
  async countAll() {
    const sql = `SELECT COUNT(*) AS total FROM users;`;
    const res = await this.query(sql);
    return parseInt(res.rows[0]?.total || '0', 10);
  }

  /**
   * Find all users (returns array)
   * Compatible with reference repo check: const existingUser = await this.userRepository.findAll();
   * @returns {Promise<Array>}
   */
  async findAll() {
    const sql = `SELECT id, username, name, email, role, client_id, is_active FROM users;`;
    const res = await this.query(sql);
    return res.rows;
  }

  /**
   * Find user by username
   * @param {string} username - User unique username
   */
  async findByUsername(username) {
    if (!username) return null;
    const sql = `
      SELECT id, username, name, email, password_hash, role, client_id, permissions, is_active, created_at
      FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1;
    `;
    const res = await this.query(sql, [username.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Find user by unique email address
   * @param {string} email - User email address
   */
  async findByEmail(email) {
    if (!email) return null;
    const sql = `
      SELECT id, username, name, email, password_hash, role, client_id, permissions, is_active, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const res = await this.query(sql, [email.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Find user by username or email (Supports flexible login identifiers)
   * @param {string} identifier - Username or Email
   */
  async findByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const sql = `
      SELECT id, username, name, email, password_hash, role, client_id, permissions, is_active, created_at
      FROM users
      WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const res = await this.query(sql, [identifier.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Find user by primary ID
   * @param {string} id - UUID of user
   */
  async findById(id) {
    if (!id) return null;
    const sql = `
      SELECT id, username, name, email, password_hash, role, client_id, permissions, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const res = await this.query(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find user profile by ID including joined client organization data (Excludes password_hash)
   * @param {string} id - UUID of user
   */
  async findProfileById(id) {
    if (!id) return null;
    const sql = `
      SELECT 
        u.id, 
        u.username, 
        u.name, 
        u.email, 
        u.role, 
        u.client_id, 
        u.permissions, 
        u.is_active, 
        u.created_at, 
        u.updated_at,
        c.name AS client_name,
        c.slug AS client_slug
      FROM users u
      LEFT JOIN clients c ON u.client_id = c.id
      WHERE u.id = $1
      LIMIT 1;
    `;
    const res = await this.query(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Create a new user account
   * @param {Object} userData
   */
  async createUser({
    username,
    name,
    email,
    passwordHash,
    role = 'client_viewer',
    clientId = null,
    permissions = {},
  }) {
    const finalName = name && name.trim() ? name.trim() : username.trim();
    const defaultPermissions = {
      canCreateApiKeys: role === 'client_admin' || role === 'super_admin',
      canManageUsers: role === 'client_admin' || role === 'super_admin',
      canViewAnalytics: true,
      canExportData: role === 'client_admin' || role === 'super_admin',
      ...permissions,
    };

    const sql = `
      INSERT INTO users (
        username,
        name,
        email,
        password_hash,
        role,
        client_id,
        permissions,
        is_active
      )
      VALUES (
        LOWER($1),
        $2,
        LOWER($3),
        $4,
        $5,
        $6,
        $7::jsonb,
        TRUE
      )
      RETURNING id, username, name, email, role, client_id, permissions, is_active, created_at;
    `;

    const res = await this.query(sql, [
      username.trim(),
      finalName,
      email.trim(),
      passwordHash,
      role,
      clientId,
      JSON.stringify(defaultPermissions),
    ]);

    return res.rows[0];
  }


  async create(userData) {
    return this.createUser(userData);
  }

    
  // List users with optional role, clientId filter, and pagination

  async listUsers({ role, clientId, limit = 20, offset = 0 }) {
    const conditions = [];
    const params = [];

    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }

    if (clientId) {
      params.push(clientId);
      conditions.push(`u.client_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM users u ${whereClause};`;
    const countRes = await this.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT 
        u.id, 
        u.username, 
        u.name, 
        u.email, 
        u.role, 
        u.client_id, 
        u.permissions, 
        u.is_active, 
        u.created_at,
        c.name AS client_name
      FROM users u
      LEFT JOIN clients c ON u.client_id = c.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const res = await this.query(sql, params);

    return {
      total,
      limit,
      offset,
      users: res.rows,
    };
  }

  
  // Update user role
  
  async updateRole(id, newRole) {
    const sql = `
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, name, email, role, client_id, is_active;
    `;
    const res = await this.query(sql, [newRole, id]);
    return res.rows[0] || null;
  }
}

export default UserRepository;
