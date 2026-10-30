import OpenAI from 'openai';
import CircuitBreaker from 'opossum';
import config from '../../shared/config/index.js';
import logger from '../../shared/config/logger.js';
import AppError from '../../shared/utils/AppError.js';
import { INVOICE_EXTRACTION_SYSTEM_PROMPT, INVOICE_JSON_SCHEMA } from './promptTemplates.js';


// AIExtractionService
 
class AIExtractionService {
  constructor() {
    this.openai = config.openai.apiKey
      ? new OpenAI({ apiKey: config.openai.apiKey })
      : null;

    // Circuit Breaker configuration for OpenAI API calls
    const breakerOptions = {
      timeout: 45000, // 45 seconds timeout for LLM inference
      errorThresholdPercentage: 50, // Trip breaker if 50% calls fail
      resetTimeout: 30000, // Wait 30 seconds before half-open retry
    };

    this.breaker = new CircuitBreaker(this._executeOpenAIExtraction.bind(this), breakerOptions);

    this.breaker.on('open', () => logger.warn('CIRCUIT BREAKER OPEN: OpenAI API is currently unresponsive'));
    this.breaker.on('halfOpen', () => logger.info('CIRCUIT BREAKER HALF-OPEN: Testing OpenAI API recovery'));
    this.breaker.on('close', () => logger.info('CIRCUIT BREAKER CLOSED: OpenAI API is healthy'));
  }

  
  // Internal method called by Circuit Breaker for text-based structured extraction
  async _executeOpenAIExtraction(documentText) {
    if (!this.openai) {
      throw new AppError('OpenAI API key is missing or not configured', 503);
    }

    const completion = await this.openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: INVOICE_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: `Document OCR Text to extract:\n\n${documentText}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: INVOICE_JSON_SCHEMA,
      },
    });

    const rawContent = completion.choices[0].message.content;
    const parsedData = JSON.parse(rawContent);

    return {
      extracted: parsedData,
      raw_ai_response: completion,
      usage: completion.usage,
    };
  }

  /**
   * Public extraction method wrapped by Circuit Breaker
   * @param {string} documentText - Extracted text from PDF or OCR
   */
  async extractInvoiceData(documentText) {
    if (!documentText || documentText.trim().length === 0) {
      throw new AppError('Cannot extract data from empty document text', 400);
    }

    try {
      return await this.breaker.fire(documentText);
    } catch (error) {
      logger.error('AI Structured Extraction failed through circuit breaker', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Vision Fallback for degraded scans, poor quality photos, or low-OCR-confidence pages
   * Directly passes image base64 data to OpenAI Vision
   */
  async extractWithVisionFallback(imageBase64, mimeType = 'image/png') {
    if (!this.openai) {
      throw new AppError('OpenAI API key missing for vision extraction', 503);
    }

    logger.info('Executing Vision Fallback extraction via GPT-4o Vision');

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: INVOICE_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract invoice data directly from this document image:' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: INVOICE_JSON_SCHEMA,
      },
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    return {
      extracted: parsed,
      raw_ai_response: completion,
      is_vision_fallback: true,
    };
  }

  
  //  Generate 1536-dimensional vector embedding for pgvector storage
  async createEmbedding(text) {
    if (!this.openai || !text) return null;

    try {
      const response = await this.openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: text.slice(0, 8000), // Enforce token limit
      });
      return response.data[0].embedding;
    } catch (err) {
      logger.error('Failed to generate embedding', { error: err.message });
      return null;
    }
  }
}

export default new AIExtractionService();

