import pkg from 'pg';
const { Pool } = pkg;
import config from './index.js';
import logger from './logger.js';

/**
 * PostgreSQL Connection Pool
 */
const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: config.postgres.max,
  idleTimeoutMillis: config.postgres.idleTimeoutMillis,
  connectionTimeoutMillis: config.postgres.connectionTimeoutMillis,
});

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
});

/**
 * Execute SQL queries with automated execution time logging
 * @param {string} text - SQL Query string
 * @param {Array} params - Parameterized values
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow query detected: ${duration}ms`, { query: text });
    }
    return res;
  } catch (error) {
    logger.error('Database query error', { query: text, error: error.message });
    throw error;
  }
};

/**
 * Acquire a dedicated client from the pool.
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export default {
  pool,
  query,
  getClient,
};

