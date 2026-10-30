import { Queue } from 'bullmq';
import redisClient, { redisConnectionOptions } from '../../shared/config/redis.js';
import logger from '../../shared/config/logger.js';



export const QUEUE_NAMES = {
  PROCESS: 'document-process',
  EXTRACT: 'document-extract',
  VALIDATE: 'document-validate',
  EMBED: 'document-embed',
  DLQ: 'document-dead-letter',
};


// Default Job Configuration with Exponential Backoff

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s retries
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

// Queue instances
export const processQueue = new Queue(QUEUE_NAMES.PROCESS, {
  connection: redisConnectionOptions,
  defaultJobOptions,
});

export const extractQueue = new Queue(QUEUE_NAMES.EXTRACT, {
  connection: redisConnectionOptions,
  defaultJobOptions,
});

export const validateQueue = new Queue(QUEUE_NAMES.VALIDATE, {
  connection: redisConnectionOptions,
  defaultJobOptions,
});

export const embedQueue = new Queue(QUEUE_NAMES.EMBED, {
  connection: redisConnectionOptions,
  defaultJobOptions,
});

export const dlqQueue = new Queue(QUEUE_NAMES.DLQ, {
  connection: redisConnectionOptions,
});

/**
 * Dispatch an incoming document into the initial processing queue
 * @param {Object} payload - { documentId, filePath, fileType, originalFilename }
 */
export const enqueueDocumentProcessing = async (payload) => {
  const job = await processQueue.add(
    'process-document',
    payload,
    {
      jobId: payload.documentId, // Idempotent: One job per document ID
    }
  );
  logger.info(`Document queued for processing`, { documentId: payload.documentId, jobId: job.id });
  return job;
};

/**
 * Publish live pipeline progress updates via Redis Pub/Sub for SSE streaming
 * @param {string} documentId - Document UUID
 * @param {Object} data - Progress info (stage, percent, message, status)
 */
export const publishProgress = async (documentId, data) => {
  try {
    const payload = JSON.stringify({
      documentId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    // Publish to document-specific channel
    await redisClient.publish(`doc-events:${documentId}`, payload);
  } catch (err) {
    logger.error('Failed to publish progress event', { documentId, error: err.message });
  }
};

export default {
  QUEUE_NAMES,
  processQueue,
  extractQueue,
  validateQueue,
  embedQueue,
  dlqQueue,
  enqueueDocumentProcessing,
  publishProgress,
};

