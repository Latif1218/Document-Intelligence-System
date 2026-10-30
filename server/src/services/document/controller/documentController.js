import ResponseFormatter from '../../../shared/utils/responseFormatter.js';
import logger from '../../../shared/config/logger.js';


// DocumentController
class DocumentController {
  constructor(documentService) {
    this.documentService = documentService;

    // Bind methods to ensure correct execution context
    this.upload = this.upload.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.getResults = this.getResults.bind(this);
    this.list = this.list.bind(this);
    this.applyCorrections = this.applyCorrections.bind(this);
    this.reprocess = this.reprocess.bind(this);
    this.streamEvents = this.streamEvents.bind(this);
  }


  // Helper to build unified tenant and user context from request
  getAuthContext(req) {
    return {
      user: req.user || null,
      client: req.client || null,
      clientId: req.clientId || (req.user ? (req.user.clientId || req.user.client_id) : null),
    };
  }

  
  // Accepts multiple document files and associates them with authenticated client & user
  async upload(req, res, next) {
    try {
      const files = req.files || (req.file ? [req.file] : []);
      const authContext = this.getAuthContext(req);
      const queuedJobs = await this.documentService.uploadDocuments(files, authContext);

      return ResponseFormatter.success(
        res,
        queuedJobs,
        'Documents received and queued for processing successfully',
        202
      );
    } catch (error) {
      next(error);
    }
  }

 
  // Returns current processing stage and status (verified by multi-tenant ownership)
  async getStatus(req, res, next) {
    try {
      const { id } = req.params;
      const authContext = this.getAuthContext(req);
      const statusData = await this.documentService.getStatus(id, authContext);
      return ResponseFormatter.success(res, statusData, 'Document status retrieved');
    } catch (error) {
      next(error);
    }
  }


  // Returns structured invoice data, line items, and audit trail
  async getResults(req, res, next) {
    try {
      const { id } = req.params;
      const authContext = this.getAuthContext(req);
      const results = await this.documentService.getResults(id, authContext);
      return ResponseFormatter.success(res, results, 'Document results retrieved');
    } catch (error) {
      next(error);
    }
  }


  // List processed documents isolated to current client (or all documents for Super Admins)
  async list(req, res, next) {
    try {
      const authContext = this.getAuthContext(req);
      const result = await this.documentService.listDocuments(req.query, authContext);
      return ResponseFormatter.success(res, result.documents, 'Documents list retrieved', 200, {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
      });
    } catch (error) {
      next(error);
    }
  }

  // Apply user manual corrections to extracted data
  async applyCorrections(req, res, next) {
    try {
      const { id } = req.params;
      const authContext = this.getAuthContext(req);
      const updated = await this.documentService.applyCorrections(id, req.body, authContext);
      return ResponseFormatter.success(res, updated, 'Corrections applied successfully');
    } catch (error) {
      next(error);
    }
  }

  // Manually trigger re-processing for a document
  async reprocess(req, res, next) {
    try {
      const { id } = req.params;
      const authContext = this.getAuthContext(req);
      const reprocessResult = await this.documentService.reprocessDocument(id, authContext);
      return ResponseFormatter.success(
        res,
        reprocessResult,
        'Document re-processing queued successfully',
        202
      );
    } catch (error) {
      next(error);
    }
  }


  // Server-Sent Events (SSE) endpoint for real-time progress streaming
  async streamEvents(req, res, next) {
    const { id } = req.params;

    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx)
    res.flushHeaders();

    logger.info(`SSE connection established for document ${id} by: ${req.user ? req.user.email : (req.client ? req.client.name : 'api-key')}`);

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', documentId: id, timestamp: new Date() })}\n\n`);

    // Subscribe to Redis Pub/Sub events
    const unsubscribe = this.documentService.subscribeToEvents(
      id,
      (eventData) => {
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      },
      (error) => {
        res.write(`data: ${JSON.stringify({ type: 'ERROR', error: error.message })}\n\n`);
      }
    );

    // Keep-alive heartbeat every 15 seconds to avoid proxy timeout
    const heartbeatInterval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    // Clean up when client disconnects
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
      logger.info(`SSE connection closed for document ${id}`);
    });
  }
}

export default DocumentController;
