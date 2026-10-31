import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './shared/config/index.js';
import logger from './shared/config/logger.js';
import postgres from './shared/config/postgres.js';
import redisClient from './shared/config/redis.js';
import { ensureBucketExists } from './shared/config/s3.js';
import requestLogger from './shared/middlewares/requestLogger.js';
import errorHandler from './shared/middlewares/errorHandler.js';
import ResponseFormatter from './shared/utils/responseFormatter.js';
import AppError from './shared/utils/AppError.js';

// Domain Routers
import authRouter from './services/auth/routes/authRoutes.js';
import clientRouter from './services/client/routes/clientRoutes.js';
import documentRouter from './services/document/routes/documentRoutes.js';
import searchRouter from './services/search/routes/searchRoutes.js';


// Initialize Express Application
const app = express();


// Security & Parsing Middlewares
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true, // Allow cookies
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Request Logging Middleware
app.use(requestLogger);


// API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
});

app.use('/auth', apiLimiter);
app.use('/api/auth', apiLimiter);
app.use('/admin/clients', apiLimiter);
app.use('/documents', apiLimiter);
app.use('/search', apiLimiter);


// Welcome & Health Check Endpoints
app.get('/', (req, res) => {
  return ResponseFormatter.success(
    res,
    {
      system: 'AI-Powered Document Intelligence System',
      status: 'UP',
      version: '1.0.0',
      routes: {
        auth: {
          onboardSuperAdmin: 'POST /auth/onboard-super-admin (One-time initial onboarding)',
          login: 'POST /auth/login (Cookie-based JWT session)',
          logout: 'POST /auth/logout',
          me: 'GET /auth/me',
          users: 'GET /auth/users',
        },
        clients: {
          list: 'GET /admin/clients',
          onboard: 'POST /admin/clients/onboard (Super Admin creates client with auto API key)',
          createUser: 'POST /admin/clients/:clientId/users (client_admin or client_viewer)',
          createApiKey: 'POST /admin/clients/:clientId/api/keys',
          listApiKeys: 'GET /admin/clients/:clientId/api/keys',
        },
        documents: 'GET, POST /documents',
        search: 'GET /search?q=...',
        health: 'GET /health',
      },
    },
    'Document Intelligence API is operational'
  );
});

app.get('/health', async (req, res) => {
  try {
    await postgres.query('SELECT 1;');
    await redisClient.ping();

    return ResponseFormatter.success(
      res,
      {
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.app.env,
      },
      'Document Intelligence API is healthy'
    );
  } catch (err) {
    return ResponseFormatter.error(res, 'Health check failed: Database or Redis is unreachable', 503, {
      error: err.message,
    });
  }
});


// Application Routes
app.use('/auth', authRouter);
app.use('/api/auth', authRouter); // Exact reference repo alias
app.use('/admin/clients', clientRouter);
app.use('/', clientRouter); // Direct path support
app.use('/documents', documentRouter);
app.use('/search', searchRouter);


// 404 Route Not Found Handler
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});


// Centralized Global Error Handler
app.use(errorHandler);


// Start Server and Initialize External Storage
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.app.port, async () => {
    logger.info(`Document Intelligence REST API running on port: ${config.app.port} [${config.app.env}]`);
    try {
      await ensureBucketExists();
      logger.info('Storage layer successfully verified');
    } catch (err) {
      logger.error('Failed to initialize storage bucket on startup', { error: err.message });
    }
  });
}


// Graceful Shutdown Handlers
const shutdown = async (signal) => {
  logger.info(`${signal} signal received: closing HTTP server...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await postgres.pool.end();
        logger.info('Database connections closed.');
        await redisClient.quit();
        logger.info('Redis client disconnected.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during graceful shutdown', { error: err.message });
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection at Promise', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown', { error: error.message, stack: error.stack });
  process.exit(1);
});

export default app;
