import { Worker } from 'bullmq';
import { QUEUE_NAMES, publishProgress, dlqQueue } from './queueManager.js';
import { redisConnectionOptions } from '../../shared/config/redis.js';
import config from '../../shared/config/index.js';
import logger from '../../shared/config/logger.js';
import s3 from '../../shared/config/s3.js';
import pythonClient from '../processor/pythonClient.js';
import aiExtractionService from '../ai/aiExtractionService.js';
import validationEngine from '../validation/validationEngine.js';
import { documentRepository } from '../document/Dependencies/dependencies.js';


// PipelineWorker

class PipelineWorker {
  constructor() {
    this.worker = null;
  }

  
  // Helper to convert readable stream from MinIO S3 into a Buffer
  
  async streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  
  // Execute pipeline stages for a given job
  
  async processJob(job) {
    const { documentId, filePath, fileType, originalFilename } = job.data;
    const startTime = Date.now();

    logger.info(`Starting pipeline for document: ${documentId} (${originalFilename})`);

    try {
      // Update status to processing
      await documentRepository.updateStatus(documentId, 'processing', null);

      // Download & Python Processing (OCR / Text Extraction)

      await publishProgress(documentId, {
        stage: 'ocr_parsing',
        percent: 20,
        status: 'in_progress',
        message: 'Extracting text and structure via PyMuPDF/OCR engine...',
      });

      const s3Stream = await s3.getFileStream(filePath);
      const fileBuffer = await this.streamToBuffer(s3Stream);

      const parseStartTime = Date.now();
      const parsedResult = await pythonClient.processDocument(fileBuffer, originalFilename, fileType);
      const parseDuration = Date.now() - parseStartTime;

      await documentRepository.addProcessingHistory(
        documentId,
        'ocr_parsing',
        'completed',
        `Extracted ${parsedResult.page_count || 1} pages in ${parseDuration}ms`,
        parseDuration
      );

      // Update page count in documents table
      await documentRepository.update(documentId, { page_count: parsedResult.page_count || 1 });

      // Save raw text per page
      const pages = parsedResult.pages || [
        { page_number: 1, text: parsedResult.combined_text || '', is_ocr: false },
      ];

      for (const p of pages) {
        await documentRepository.saveExtractedPage(documentId, p.page_number, p.text);
      }

      // AI Structured Extraction
      await publishProgress(documentId, {
        stage: 'ai_extraction',
        percent: 50,
        status: 'in_progress',
        message: 'Extracting structured invoice data using OpenAI Structured Outputs...',
      });

      const aiStartTime = Date.now();
      let aiOutput;

      // Check if text is too sparse or empty, trigger Vision Fallback if image
      const combinedText = parsedResult.combined_text || pages.map((p) => p.text).join('\n');
      const isVeryLowText = combinedText.trim().length < 50;
      const isImageFile = fileType.startsWith('image/');

      if (isVeryLowText && isImageFile) {
        logger.info(`Low OCR text detected. Triggering Vision Fallback for ${documentId}`);
        const base64Image = fileBuffer.toString('base64');
        aiOutput = await aiExtractionService.extractWithVisionFallback(base64Image, fileType);
      } else {
        aiOutput = await aiExtractionService.extractInvoiceData(combinedText);
      }

      const aiDuration = Date.now() - aiStartTime;

      await documentRepository.addProcessingHistory(
        documentId,
        'ai_extraction',
        'completed',
        `AI extraction completed in ${aiDuration}ms (confidence: ${aiOutput.extracted.confidence_score})`,
        aiDuration
      );

      // Validation Engine
      
      await publishProgress(documentId, {
        stage: 'validation',
        percent: 75,
        status: 'in_progress',
        message: 'Verifying financial calculations, duplicate checks, and evidence...',
      });

      const validationStartTime = Date.now();
      const validationResult = await validationEngine.validate(
        aiOutput.extracted,
        documentId,
        combinedText
      );
      const validationDuration = Date.now() - validationStartTime;

      await documentRepository.addProcessingHistory(
        documentId,
        'validation',
        validationResult.isValid ? 'completed' : 'flagged',
        `Validation finished with ${validationResult.errors.length} findings (needs_review: ${validationResult.needsReview})`,
        validationDuration
      );

      // Persist validation errors if any
      await documentRepository.saveValidationErrors(documentId, validationResult.errors);

      
      // Semantic Vector Embeddings & Final Persistence
      
      await publishProgress(documentId, {
        stage: 'embedding',
        percent: 90,
        status: 'in_progress',
        message: 'Generating semantic vector embeddings for hybrid search...',
      });

      // Generate embedding for pgvector hybrid search
      const embedding = await aiExtractionService.createEmbedding(combinedText);
      if (embedding && pages.length > 0) {
        // Update first page or document aggregate with embedding vector
        await documentRepository.query(
          `UPDATE extracted_text SET embedding = $1::vector WHERE document_id = $2 AND page_number = 1;`,
          [`[${embedding.join(',')}]`, documentId]
        );
      }

      // Save structured invoice and line items
      const invoiceData = {
        ...aiOutput.extracted,
        raw_ai_response: aiOutput.raw_ai_response,
        needs_review: validationResult.needsReview,
      };

      await documentRepository.saveInvoiceAndItems(
        documentId,
        invoiceData,
        aiOutput.extracted.line_items || []
      );

      // Update document status to completed
      await documentRepository.updateStatus(documentId, 'completed', null);

      const totalPipelineDuration = Date.now() - startTime;
      await documentRepository.addProcessingHistory(
        documentId,
        'pipeline',
        'completed',
        `Entire document processing pipeline successfully completed in ${totalPipelineDuration}ms`,
        totalPipelineDuration
      );

      // Final success progress broadcast
      await publishProgress(documentId, {
        stage: 'completed',
        percent: 100,
        status: 'completed',
        needs_review: validationResult.needsReview,
        message: 'Document processing finished successfully',
      });

      logger.info(`Pipeline completed successfully for document ${documentId} in ${totalPipelineDuration}ms`);
      return { success: true, documentId };
    } catch (error) {
      logger.error(`Pipeline failed for document ${documentId}`, {
        error: error.message,
        stack: error.stack,
      });

      // Record failed audit history
      await documentRepository.addProcessingHistory(
        documentId,
        'pipeline',
        'failed',
        `Error: ${error.message}`
      );

      // If attempts exhausted, mark document as failed and enqueue to DLQ
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await documentRepository.updateStatus(documentId, 'failed', error.message);
        await dlqQueue.add('dead-letter-job', {
          ...job.data,
          failedReason: error.message,
          failedAt: new Date().toISOString(),
        });
        await publishProgress(documentId, {
          stage: 'failed',
          percent: 100,
          status: 'failed',
          message: `Processing failed permanently: ${error.message}`,
        });
      }

      throw error; // Re-throw to trigger BullMQ exponential backoff retry
    }
  }

  
  // Start the BullMQ Worker process
  start() {
    this.worker = new Worker(
      QUEUE_NAMES.PROCESS,
      async (job) => {
        return await this.processJob(job);
      },
      {
        connection: redisConnectionOptions,
        concurrency: config.worker.concurrency,
      }
    );

    this.worker.on('ready', () => {
      logger.info(`BullMQ Pipeline Worker started with concurrency: ${config.worker.concurrency}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.warn(`Job ${job?.id} failed on attempt ${job?.attemptsMade}: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      logger.error('BullMQ Worker encountered an error', { error: err.message });
    });
  }

  
  // Graceful shutdown of worker
  async stop() {
    if (this.worker) {
      await this.worker.close();
      logger.info('BullMQ Pipeline Worker stopped gracefully');
    }
  }
}

export default new PipelineWorker();

