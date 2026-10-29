import Redis from 'ioredis';
import config from './index.js';
import logger from './logger.js';

/**
 * Redis Connection 
 */
export const redisConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, 
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

/**
 * Standard Redis Client Instance
 */
const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

/**
 * Helper to create a new Redis client instance 
 */
export const createRedisClient = () => {
  return new Redis(redisConnectionOptions);
};

export default redisClient;

