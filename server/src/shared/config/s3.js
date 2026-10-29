import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import config from './index.js';
import logger from './logger.js';
import AppError from '../utils/AppError.js';

/**
 * MinIO S3-Compatible Client Initialization
 */
const endpointProtocol = config.minio.useSSL ? 'https' : 'http';
const s3Client = new S3Client({
  endpoint: `${endpointProtocol}://${config.minio.endpoint}:${config.minio.port}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true, 
});

/**
 * Ensure the default storage bucket exists on startup
 */
export const ensureBucketExists = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.minio.bucketName }));
    logger.info(`MinIO bucket "${config.minio.bucketName}" verified`);
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      logger.info(`Bucket "${config.minio.bucketName}" not found. Creating bucket...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: config.minio.bucketName }));
      logger.info(`MinIO bucket "${config.minio.bucketName}" created successfully`);
    } else {
      logger.error('Failed to verify MinIO bucket', { error: err.message });
    }
  }
};

/**
 * Upload a file buffer or stream to MinIO
 * @param {string} key - Unique object path/filename in bucket
 * @param {Buffer|ReadableStream} body - File data
 * @param {string} contentType - File MIME type
 */
export const uploadFile = async (key, body, contentType) => {
  try {
    const command = new PutObjectCommand({
      Bucket: config.minio.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await s3Client.send(command);
    return key;
  } catch (error) {
    logger.error('Error uploading file to MinIO', { key, error: error.message });
    throw new AppError(`Storage upload failed: ${error.message}`, 500);
  }
};

/**
 * Retrieve a file stream from MinIO
 * @param {string} key - Object key in bucket
 */
export const getFileStream = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.minio.bucketName,
      Key: key,
    });
    const response = await s3Client.send(command);
    return response.Body;
  } catch (error) {
    logger.error('Error fetching file from MinIO', { key, error: error.message });
    throw new AppError(`File not found in storage: ${error.message}`, 404);
  }
};

/**
 * Delete a file from MinIO
 * @param {string} key - Object key in bucket
 */
export const deleteFile = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.minio.bucketName,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    logger.error('Error deleting file from MinIO', { key, error: error.message });
    throw new AppError(`Storage deletion failed: ${error.message}`, 500);
  }
};

export default {
  s3Client,
  ensureBucketExists,
  uploadFile,
  getFileStream,
  deleteFile,
};

