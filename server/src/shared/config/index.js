import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuration Object
 */

const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 5000,
    apiKey: process.env.API_KEY || 'doc_intel_secret_key_2026',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // AUTH & USER MANAGEMENT (JWT & COOKIE)
  jwt: {
    secret: process.env.JWT_SECRET || 'doc_intel_super_secret_jwt_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    expiresIn: parseInt(process.env.COOKIE_EXPIRES_MS, 10) || 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },

  superAdmin: {
    username: process.env.ADMIN_USERNAME || process.env.SUPER_ADMIN_USERNAME,
    name: process.env.SUPER_ADMIN_NAME,
    email: process.env.ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD,
  },

  apiKeyConfig: {
    prefix: process.env.API_KEY_PREFIX || 'docintel',
    expiryDays: parseInt(process.env.API_KEY_EXPIRY_DAYS || '365', 10),
  },

  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    database: process.env.POSTGRES_DB || 'document_intelligence',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 20, 
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucketName: process.env.MINIO_BUCKET_NAME || 'documents',
  },

  pythonService: {
    url: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
    timeoutMs: 60000, 
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL,
  },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY, 10) || 5,
  },

  upload: {
    maxFileSizeBytes: (parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 50) * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
    ],
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
};

export default config;
