import postgres from '../../../shared/config/postgres.js';
import AppError from '../../../shared/utils/AppError.js';


// BaseRepository

class BaseRepository {
  constructor(tableName, db = postgres) {
    this.tableName = tableName;
    this.db = db;
  }

  /**
   * Execute a parameterized query
   * @param {string} text - SQL Query
   * @param {Array} params - Query Parameters
   */
  async query(text, params = []) {
    return await this.db.query(text, params);
  }

  /**
   * Find a record by its UUID primary key 
   * @param {string} id - Record UUID
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1;`;
    const result = await this.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Insert a new row dynamically
   * @param {Object} data - Key-value pair of columns and values
   */
  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      throw new AppError('No data provided for insertion', 400);
    }

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Update an existing row by ID dynamically
   * @param {string} id - Record UUID
   * @param {Object} data - Key-value pair of columns to update
   */
  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      return this.findById(id);
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${keys.length + 1}
      RETURNING *;
    `;

    const result = await this.query(sql, [...values, id]);
    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record UUID
   */
  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *;`;
    const result = await this.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Execute callback within an isolated database transaction
   * @param {Function} callback - Async function with client parameter
   */
  async withTransaction(callback) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default BaseRepository;

