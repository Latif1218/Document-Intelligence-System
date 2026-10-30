import logger from './shared/config/logger.js';
import postgres from './shared/config/postgres.js';
import { ensureBucketExists } from './shared/config/s3.js';
import pipelineWorker from './services/queue/pipelineWorker.js';


// Worker Entry Point
async function startWorker() {
  try {
    logger.info('Initializing Document Intelligence Pipeline Worker...');

    // Verify PostgreSQL connection
    await postgres.query('SELECT 1;');
    logger.info('Database connection verified for worker');

    // Ensure MinIO bucket exists
    await ensureBucketExists();

    // Start BullMQ consumer
    pipelineWorker.start();

    logger.info('Pipeline Worker is running and listening for document jobs.');
  } catch (error) {
    logger.error('Failed to start Pipeline Worker', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Graceful shutdown handling
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down worker gracefully...`);
  try {
    await pipelineWorker.stop();
    await postgres.pool.end();
    logger.info('Worker shutdown complete. Exiting process.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', { error: err.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection in Worker', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in Worker', { error: error.message, stack: error.stack });
  process.exit(1);
});

startWorker();

