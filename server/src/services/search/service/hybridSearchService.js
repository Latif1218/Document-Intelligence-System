import OpenAI from 'openai';
import postgres from '../../../shared/config/postgres.js';
import config from '../../../shared/config/index.js';
import logger from '../../../shared/config/logger.js';


// HybridSearchService
class HybridSearchService {
  constructor(db = postgres) {
    this.db = db;
    this.openai = config.openai.apiKey
      ? new OpenAI({ apiKey: config.openai.apiKey })
      : null;
    this.kConstant = 60; // Standard RRF smoothing constant
  }

  
  // Generate vector embedding for a query string
  async generateEmbedding(queryText) {
    if (!this.openai) {
      logger.warn('OpenAI API key missing. Operating in keyword-only fallback mode.');
      return null;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: queryText,
      });
      return response.data[0].embedding;
    } catch (err) {
      logger.warn('Vector embedding generation failed. Falling back to keyword search.', {
        error: err.message,
      });
      return null;
    }
  }

  // Full-Text Search FTS using PostgreSQL tsvector and tsquery
  async executeKeywordSearch(queryText, filters = {}, limit = 20) {
    const conditions = ["et.tsv_content @@ plainto_tsquery('english', $1)"];
    const params = [queryText];

    if (filters.clientId) {
      params.push(filters.clientId);
      conditions.push(`d.client_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`d.status = $${params.length}`);
    }
    if (filters.supplier) {
      params.push(`%${filters.supplier}%`);
      conditions.push(`inv.supplier_name ILIKE $${params.length}`);
    }
    if (filters.needs_review !== undefined) {
      params.push(filters.needs_review);
      conditions.push(`inv.needs_review = $${params.length}`);
    }

    params.push(limit);
    const limitPlaceholder = `$${params.length}`;

    const sql = `
      SELECT 
        et.id AS text_id,
        et.document_id,
        et.page_number,
        et.raw_text,
        ts_rank_cd(et.tsv_content, plainto_tsquery('english', $1)) AS fts_score,
        d.original_filename,
        d.status,
        d.client_id,
        inv.invoice_number,
        inv.supplier_name,
        inv.total,
        inv.needs_review
      FROM extracted_text et
      JOIN documents d ON d.id = et.document_id
      LEFT JOIN invoices inv ON inv.document_id = et.document_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY fts_score DESC
      LIMIT ${limitPlaceholder};
    `;

    const result = await this.db.query(sql, params);
    return result.rows;
  }


  // Semantic Vector Search using pgvector cosine distance
  async executeSemanticSearch(embedding, filters = {}, limit = 20) {
    if (!embedding) return [];

    const embeddingStr = `[${embedding.join(',')}]`;
    const conditions = ['et.embedding IS NOT NULL'];
    const params = [embeddingStr];

    if (filters.clientId) {
      params.push(filters.clientId);
      conditions.push(`d.client_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`d.status = $${params.length}`);
    }
    if (filters.supplier) {
      params.push(`%${filters.supplier}%`);
      conditions.push(`inv.supplier_name ILIKE $${params.length}`);
    }
    if (filters.needs_review !== undefined) {
      params.push(filters.needs_review);
      conditions.push(`inv.needs_review = $${params.length}`);
    }

    params.push(limit);
    const limitPlaceholder = `$${params.length}`;

    const sql = `
      SELECT 
        et.id AS text_id,
        et.document_id,
        et.page_number,
        et.raw_text,
        1 - (et.embedding <=> $1::vector) AS semantic_similarity,
        d.original_filename,
        d.status,
        d.client_id,
        inv.invoice_number,
        inv.supplier_name,
        inv.total,
        inv.needs_review
      FROM extracted_text et
      JOIN documents d ON d.id = et.document_id
      LEFT JOIN invoices inv ON inv.document_id = et.document_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY et.embedding <=> $1::vector ASC
      LIMIT ${limitPlaceholder};
    `;

    const result = await this.db.query(sql, params);
    return result.rows;
  }


  // Reciprocal Rank Fusion (RRF) Merge Algorithm
  mergeWithRRF(ftsResults, semanticResults, limit = 20) {
    const scores = new Map();
    const documentMap = new Map();

    // Score FTS Rankings
    ftsResults.forEach((doc, index) => {
      const docKey = `${doc.document_id}_${doc.page_number}`;
      const rank = index + 1;
      const rrf = 1 / (this.kConstant + rank);
      scores.set(docKey, (scores.get(docKey) || 0) + rrf);
      if (!documentMap.has(docKey)) {
        documentMap.set(docKey, { ...doc, search_type: 'fts' });
      }
    });

    // Score Semantic Rankings
    semanticResults.forEach((doc, index) => {
      const docKey = `${doc.document_id}_${doc.page_number}`;
      const rank = index + 1;
      const rrf = 1 / (this.kConstant + rank);
      scores.set(docKey, (scores.get(docKey) || 0) + rrf);

      if (documentMap.has(docKey)) {
        const existing = documentMap.get(docKey);
        existing.search_type = 'hybrid';
        existing.semantic_similarity = doc.semantic_similarity;
      } else {
        documentMap.set(docKey, { ...doc, search_type: 'semantic' });
      }
    });

    // Sort by combined RRF score
    const combined = Array.from(scores.entries())
      .map(([key, score]) => ({
        ...documentMap.get(key),
        rrf_score: parseFloat(score.toFixed(6)),
      }))
      .sort((a, b) => b.rrf_score - a.rrf_score)
      .slice(0, limit);

    return combined;
  }

  // Public Search API: Executes Hybrid Search with automatic graceful degradation
  async search({ queryText, filters = {}, limit = 20 }) {
    if (!queryText || queryText.trim().length === 0) {
      return { total: 0, results: [], searchMode: 'none' };
    }

    const trimmedQuery = queryText.trim();
    const embedding = await this.generateEmbedding(trimmedQuery);

    const ftsPromise = this.executeKeywordSearch(trimmedQuery, filters, limit);
    const semanticPromise = embedding
      ? this.executeSemanticSearch(embedding, filters, limit)
      : Promise.resolve([]);

    const [ftsResults, semanticResults] = await Promise.all([ftsPromise, semanticPromise]);

    // Fallback If no vector results available, return pure FTS
    if (!semanticResults.length) {
      return {
        total: ftsResults.length,
        searchMode: 'keyword_only_fallback',
        results: ftsResults.map((r) => ({ ...r, search_type: 'fts' })),
      };
    }

    // Merge using RRF
    const rrfResults = this.mergeWithRRF(ftsResults, semanticResults, limit);

    return {
      total: rrfResults.length,
      searchMode: 'hybrid_rrf',
      results: rrfResults,
    };
  }
}

export default HybridSearchService;

