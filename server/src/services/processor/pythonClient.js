import axios from 'axios';
import config from '../../shared/config/index.js';
import logger from '../../shared/config/logger.js';
import AppError from '../../shared/utils/AppError.js';

/**
 * PythonClient
 * Communicates with the FastAPI Python Processing Service for:
 */
class PythonClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.pythonService.url,
      timeout: config.pythonService.timeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  /**
   * Health check to ensure Python OCR service container is reachable
   */
  async checkHealth() {
    try {
      const res = await this.client.get('/health');
      return res.data?.status === 'ok';
    } catch (err) {
      logger.error('Python Processing Service health check failed', { error: err.message });
      return false;
    }
  }

  /**
   * Send file buffer to Python processing service using Node 20+ native FormData and Blob
   * @param {Buffer} fileBuffer - Document raw buffer
   * @param {string} filename - Original filename
   * @param {string} mimeType - MIME type
   */
  async processDocument(fileBuffer, filename, mimeType) {
    try {
      const formData = new FormData();
      const fileBlob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', fileBlob, filename);

      const response = await this.client.post('/process', formData);

      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      logger.error('Python service document processing failed', {
        filename,
        error: errorMsg,
      });
      throw new AppError(`Document parser service error: ${errorMsg}`, 502);
    }
  }
}

export default new PythonClient();
