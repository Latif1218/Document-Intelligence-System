import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import s3 from '../../../shared/config/s3.js';
import { createRedisClient } from '../../../shared/config/redis.js';
import logger from '../../../shared/config/logger.js';
import AppError from '../../../shared/utils/AppError.js';
import { enqueueDocumentProcessing } from '../../queue/queueManager.js';
import { APPLICATION_ROLES } from '../../../shared/constants/roles.js';


// DocumentService
class DocumentService {
  constructor(documentRepository) {
    this.documentRepository = documentRepository;
  }

  /**
   * Process multiple file uploads with multi-tenant client and user ownership:
   * 1. Store raw file into MinIO S3
   * 2. Persist metadata into PostgreSQL with client_id and user_id
   * 3. Enqueue job into BullMQ
   * 4. Return 202 Accepted payload
   *
   * @param {Array<Express.Multer.File>} files - Array of files from multer
   * @param {Object} authContext - { user, client, clientId }
   */
  async uploadDocuments(files, authContext = {}) {
    if (!files || files.length === 0) {
      throw new AppError('No files uploaded. Please provide at least one valid file.', 400);
    }

    const { user, client, clientId: directClientId } = authContext;
    const resolvedClientId = directClientId || (user ? (user.clientId || user.client_id) : (client ? (client.id || client._id) : null));
    const resolvedUserId = user ? (user.userId || user.id) : null;

    const queuedJobs = [];

    for (const file of files) {
      const docId = uuidv4();
      const ext = path.extname(file.originalname).toLowerCase();
      const s3Key = `uploads/${docId}${ext}`;

      // Upload original file to MinIO S3
      await s3.uploadFile(s3Key, file.buffer, file.mimetype);

      // Persist document record with client_id and user_id
      await this.documentRepository.create({
        id: docId,
        client_id: resolvedClientId, // Multi-tenant client ownership
        user_id: resolvedUserId,     // Uploader user account
        original_filename: file.originalname,
        file_path: s3Key,
        file_type: file.mimetype || ext,
        file_size: file.size,
        status: 'queued',
      });

      // Log initial audit trail
      const auditDetails = user ? ` by user "${user.email}"` : (client ? ` via API key for client "${client.name}"` : '');
      await this.documentRepository.addProcessingHistory(
        docId,
        'upload',
        'completed',
        `File "${file.originalname}" (${file.size} bytes) successfully uploaded${auditDetails} and queued`
      );

      // Enqueue into BullMQ pipeline
      const job = await enqueueDocumentProcessing({
        documentId: docId,
        filePath: s3Key,
        fileType: file.mimetype || ext,
        originalFilename: file.originalname,
      });

      queuedJobs.push({
        documentId: docId,
        jobId: job.id,
        filename: file.originalname,
        status: 'queued',
        clientId: resolvedClientId,
        userId: resolvedUserId,
      });
    }

    return queuedJobs;
  }

  /**
   * Get current processing status of a document (with multi-tenant check)
   * @param {string} id - Document UUID
   * @param {Object} authContext - Context for verification
   */
  async getStatus(id, authContext = {}) {
    const doc = await this.documentRepository.findById(id);
    if (!doc) {
      throw new AppError(`Document with ID "${id}" not found`, 404);
    }

    const { user, client, clientId } = authContext;
    const currentClientId = clientId || (user ? (user.clientId || user.client_id) : (client ? client.id : null));

    if (user && user.role !== APPLICATION_ROLES.SUPER_ADMIN && currentClientId) {
      if (doc.client_id && doc.client_id.toString() !== currentClientId.toString()) {
        throw new AppError('Forbidden: You do not have permission to view this document status.', 403);
      }
    }

    return {
      id: doc.id,
      filename: doc.original_filename,
      status: doc.status,
      clientId: doc.client_id,
      errorMessage: doc.error_message,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    };
  }

  /**
   * Get full extracted results (with multi-tenant isolation)
   * @param {string} id - Document UUID
   * @param {Object} authContext - Context for verification
   */
  async getResults(id, authContext = {}) {
    const result = await this.documentRepository.findWithDetails(id, authContext.user || authContext);
    if (!result) {
      throw new AppError(`Document with ID "${id}" not found`, 404);
    }
    return result;
  }

  /**
   * List processed documents with client isolation and pagination
   * @param {Object} query - Filter & pagination query
   * @param {Object} authContext - Context containing user / client
   */
  async listDocuments(query, authContext = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const user = authContext.user;
    const client = authContext.client;
    const resolvedClientId = (user && user.role === APPLICATION_ROLES.SUPER_ADMIN)
      ? (query.clientId || null)
      : (user ? (user.clientId || user.client_id) : (client ? client.id : null));

    const data = await this.documentRepository.listDocuments({
      clientId: resolvedClientId,
      userId: user ? user.id : null,
      role: user ? user.role : null,
      status: query.status,
      limit,
      offset,
    });

    return {
      ...data,
      page,
      totalPages: Math.ceil(data.total / limit),
    };
  }

  
  // Apply user corrections to invoice fields (with tenant check)
  async applyCorrections(id, updates, authContext = {}) {
    const doc = await this.documentRepository.findById(id);
    if (!doc) {
      throw new AppError(`Document with ID "${id}" not found`, 404);
    }

    const updated = await this.documentRepository.applyCorrections(id, updates, authContext.user || authContext);
    logger.info(`Manual corrections applied for document ${id} by ${authContext.user ? authContext.user.email : 'system'}`);
    return updated;
  }

  
  // Trigger re-processing for a document (with tenant check)
  async reprocessDocument(id, authContext = {}) {
    const doc = await this.documentRepository.findById(id);
    if (!doc) {
      throw new AppError(`Document with ID "${id}" not found`, 404);
    }

    const { user, clientId } = authContext;
    const currentClientId = clientId || (user ? (user.clientId || user.client_id) : null);

    if (user && user.role !== APPLICATION_ROLES.SUPER_ADMIN && currentClientId) {
      if (doc.client_id && doc.client_id.toString() !== currentClientId.toString()) {
        throw new AppError('Forbidden: You do not have permission to reprocess this document.', 403);
      }
    }

    // Reset status to queued
    await this.documentRepository.updateStatus(id, 'queued', null);

    // Audit log
    await this.documentRepository.addProcessingHistory(
      id,
      'reprocess',
      'started',
      `Document re-processing manually triggered by ${user ? user.email : 'system'}`
    );

    // Re-enqueue job
    const job = await enqueueDocumentProcessing({
      documentId: doc.id,
      filePath: doc.file_path,
      fileType: doc.file_type,
      originalFilename: doc.original_filename,
    });

    return {
      documentId: doc.id,
      jobId: job.id,
      status: 'queued',
      message: 'Document re-processing queued successfully',
    };
  }

  
  // Subscribe to live progress events via Redis Pub/Sub (for SSE)
  subscribeToEvents(documentId, onMessage, onError) {
    const subClient = createRedisClient();
    const channel = `doc-events:${documentId}`;

    subClient.subscribe(channel, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to Redis channel: ${channel}`, { error: err.message });
        if (onError) onError(err);
      }
    });

    subClient.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(message);
          onMessage(parsed);
        } catch {
          onMessage({ raw: message });
        }
      }
    });

    return () => {
      subClient.unsubscribe(channel);
      subClient.quit();
    };
  }
}

export default DocumentService;
