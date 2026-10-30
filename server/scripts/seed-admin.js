import config from '../src/shared/config/index.js';
import postgres from '../src/shared/config/postgres.js';
import logger from '../src/shared/config/logger.js';
import bcrypt from 'bcryptjs';
import { APPLICATION_ROLES } from '../src/shared/constants/roles.js';

const base = process.env.API_URL || `http://localhost:${config.app.port}`;
const body = {
  username: config.superAdmin.username,
  name: config.superAdmin.name,
  email: config.superAdmin.email,
  password: config.superAdmin.password,
};

async function seedViaHttp() {
  try {
    const res = await fetch(`${base}/auth/onboard-super-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      logger.info('----------------------------------------------------');
      logger.info('Super Admin onboarded successfully via API endpoint!');
      logger.info(`Username: ${body.username}`);
      logger.info(`Email:    ${body.email}`);
      logger.info(`Role:     ${APPLICATION_ROLES.SUPER_ADMIN}`);
      logger.info('----------------------------------------------------');
      return true;
    }

    if (res.status === 403) {
      logger.warn(`Could not onboard Super Admin (HTTP 403): ${data.message || 'Super admin onboarding is disabled'}`);
      return true;
    }

    logger.error(`API rejected Super Admin onboarding (HTTP ${res.status}): ${data.message || 'Unknown error'}`);
    return true;
  } catch (err) {
    // If server is not running, return false to trigger direct DB fallback
    return false;
  }
}

async function seedDirectDb() {
  try {
    logger.info('REST API server offline. Attempting direct database onboarding...');

    // Verify if any user exists in database 
    const checkSql = `SELECT COUNT(*) AS total FROM users;`;
    const checkRes = await postgres.query(checkSql);
    const totalUsers = parseInt(checkRes.rows[0]?.total || '0', 10);

    if (totalUsers > 0) {
      logger.warn(`Database already contains ${totalUsers} user(s). Super Admin onboarding is disabled.`);
      await postgres.pool.end();
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(body.password, salt);

    // Insert Super Admin
    const insertSql = `
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
        NULL,
        '{"canCreateApiKeys": true, "canManageUsers": true, "canViewAnalytics": true, "canExportData": true}'::jsonb,
        TRUE
      )
      RETURNING id, username, name, email, role, created_at;
    `;

    const res = await postgres.query(insertSql, [
      body.username,
      body.name,
      body.email,
      passwordHash,
      APPLICATION_ROLES.SUPER_ADMIN,
    ]);

    const createdAdmin = res.rows[0];
    logger.info('-----------------------------------------------------');
    logger.info('Super Admin account seeded successfully in database!');
    logger.info(`ID:       ${createdAdmin.id}`);
    logger.info(`Username: ${createdAdmin.username}`);
    logger.info(`Email:    ${createdAdmin.email}`);
    logger.info(`Role:     ${createdAdmin.role}`);
    logger.info('-----------------------------------------------------');

    await postgres.pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed Super Admin directly in database:', { error: error.message });
    await postgres.pool.end();
    process.exit(1);
  }
}

async function main() {
  const handledViaHttp = await seedViaHttp();
  if (!handledViaHttp) {
    await seedDirectDb();
  } else {
    process.exit(0);
  }
}

main();
