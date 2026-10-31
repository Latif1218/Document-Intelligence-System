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


  _normalizeExtractedData(parsedData) {
    if (!parsedData) return { invoices: [] };

    // Ensure invoices array exists
    let invoices = Array.isArray(parsedData.invoices) ? parsedData.invoices : [];

    // Fallback if AI returned legacy single invoice schema
    if (invoices.length === 0 && (parsedData.invoice_number || parsedData.supplier_name || parsedData.line_items)) {
      invoices = [{
        invoice_number: parsedData.invoice_number || null,
        invoice_date: parsedData.invoice_date || null,
        supplier_name: parsedData.supplier_name || null,
        customer_name: parsedData.customer_name || null,
        subtotal: parsedData.subtotal !== undefined ? parsedData.subtotal : null,
        tax: parsedData.tax !== undefined ? parsedData.tax : null,
        total: parsedData.total !== undefined ? parsedData.total : null,
        currency: parsedData.currency || 'USD',
        line_items: Array.isArray(parsedData.line_items) ? parsedData.line_items : [],
        evidence_quotes: parsedData.evidence_quotes || {},
        confidence_score: parsedData.confidence_score || 0.95,
      }];
    }

    parsedData.invoices = invoices;
    parsedData.document_type = invoices.length > 1 ? 'multi_invoice_batch' : (parsedData.document_type || 'single_invoice');

    // Attach top-level legacy aliases from primary invoice for backward compatibility
    if (invoices.length > 0) {
      const primary = invoices[0];
      parsedData.invoice_number = primary.invoice_number;
      parsedData.invoice_date = primary.invoice_date;
      parsedData.supplier_name = primary.supplier_name;
      parsedData.customer_name = primary.customer_name;
      parsedData.subtotal = primary.subtotal;
      parsedData.tax = primary.tax;
      parsedData.total = primary.total;
      parsedData.currency = primary.currency || 'USD';
      parsedData.line_items = invoices.flatMap((inv) => inv.line_items || []);
      parsedData.evidence_quotes = primary.evidence_quotes || {};
      parsedData.confidence_score = primary.confidence_score || 0.95;
    }

    // Optional batch summary if multiple invoices exist in document
    if (invoices.length > 1) {
      parsedData.batch_summary = {
        total_invoices: invoices.length,
        combined_subtotal: invoices.reduce((acc, inv) => acc + (Number(inv.subtotal) || 0), 0),
        combined_tax: invoices.reduce((acc, inv) => acc + (Number(inv.tax) || 0), 0),
        combined_total: invoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0),
      };
    }

    return parsedData;
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
    const rawParsed = JSON.parse(rawContent);
    const parsedData = this._normalizeExtractedData(rawParsed);

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

    const rawParsed = JSON.parse(completion.choices[0].message.content);
    const parsed = this._normalizeExtractedData(rawParsed);
    return {
      extracted: parsed,
      raw_ai_response: completion,
      is_vision_fallback: true,
    };
  }


  // Generate 1536-dimensional vector embedding for pgvector storage
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

