import BaseRepository from './BaseRepository.js';
import AppError from '../../../shared/utils/AppError.js';
import { APPLICATION_ROLES } from '../../../shared/constants/roles.js';


// DocumentRepository
class DocumentRepository extends BaseRepository {
  constructor() {
    super('documents');
  }

  
  // Update the document status and optional error message
  async updateStatus(documentId, status, errorMessage = null) {
    const sql = `
      UPDATE documents
      SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const result = await this.query(sql, [status, errorMessage, documentId]);
    return result.rows[0];
  }

  
  // Fetch document with all relational data
  async findWithDetails(documentId, requestingContext = null) {
    const doc = await this.findById(documentId);
    if (!doc) return null;

    if (requestingContext) {
      const userRole = requestingContext.role;
      const contextClientId = requestingContext.clientId || requestingContext.client_id;

      // If not super admin, verify client isolation
      if (userRole !== APPLICATION_ROLES.SUPER_ADMIN && contextClientId) {
        if (doc.client_id && doc.client_id.toString() !== contextClientId.toString()) {
          throw new AppError('Forbidden: You do not have permission to access this document.', 403);
        }
      }
    }

    // Fetch Invoices and Line Items
    const invoiceSql = `SELECT * FROM invoices WHERE document_id = $1 LIMIT 1;`;
    const invoiceRes = await this.query(invoiceSql, [documentId]);
    const invoice = invoiceRes.rows[0] || null;

    let lineItems = [];
    if (invoice) {
      const itemsSql = `SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY created_at ASC;`;
      const itemsRes = await this.query(itemsSql, [invoice.id]);
      lineItems = itemsRes.rows;
    }

    // Fetch Validation Errors
    const errorsSql = `SELECT * FROM validation_errors WHERE document_id = $1 ORDER BY created_at ASC;`;
    const errorsRes = await this.query(errorsSql, [documentId]);

    // Fetch Processing History (Audit Trail)
    const historySql = `SELECT * FROM processing_history WHERE document_id = $1 ORDER BY created_at ASC;`;
    const historyRes = await this.query(historySql, [documentId]);

    // Fetch Extracted Text Pages summary (without huge embedding vectors)
    const pagesSql = `SELECT id, page_number, raw_text, created_at FROM extracted_text WHERE document_id = $1 ORDER BY page_number ASC;`;
    const pagesRes = await this.query(pagesSql, [documentId]);

    // Fetch Client metadata if available
    let clientInfo = null;
    if (doc.client_id) {
      const clientRes = await this.query(
        `SELECT id, name, slug FROM clients WHERE id = $1 LIMIT 1;`,
        [doc.client_id]
      );
      clientInfo = clientRes.rows[0] || null;
    }

    return {
      ...doc,
      client: clientInfo,
      extracted_pages: pagesRes.rows,
      invoice: invoice ? { ...invoice, line_items: lineItems } : null,
      validation_errors: errorsRes.rows,
      processing_history: historyRes.rows,
    };
  }

  
  // Save extracted text per page with vector embeddings
  async saveExtractedPage(documentId, pageNumber, rawText, embedding = null) {
    const sql = `
      INSERT INTO extracted_text (document_id, page_number, raw_text, embedding)
      VALUES ($1, $2, $3, $4)
      RETURNING id, document_id, page_number;
    `;
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
    const result = await this.query(sql, [documentId, pageNumber, rawText, embeddingStr]);
    return result.rows[0];
  }

  
  // Save or update structured invoice extraction along with line items inside a transaction
  async saveInvoiceAndItems(documentId, invoiceData, lineItems = []) {
    return await this.withTransaction(async (client) => {
      // Delete existing invoice for this doc if reprocessing
      await client.query(`DELETE FROM invoices WHERE document_id = $1;`, [documentId]);

      const insertInvoiceSql = `
        INSERT INTO invoices (
          document_id, invoice_number, invoice_date, supplier_name, customer_name,
          subtotal, tax, total, currency, evidence_quotes, raw_ai_response,
          needs_review, confidence_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;

      const invoiceRes = await client.query(insertInvoiceSql, [
        documentId,
        invoiceData.invoice_number || null,
        invoiceData.invoice_date || null,
        invoiceData.supplier_name || null,
        invoiceData.customer_name || null,
        invoiceData.subtotal !== undefined ? invoiceData.subtotal : null,
        invoiceData.tax !== undefined ? invoiceData.tax : null,
        invoiceData.total !== undefined ? invoiceData.total : null,
        invoiceData.currency || 'USD',
        JSON.stringify(invoiceData.evidence_quotes || {}),
        JSON.stringify(invoiceData.raw_ai_response || {}),
        invoiceData.needs_review || false,
        invoiceData.confidence_score || 1.0,
      ]);

      const savedInvoice = invoiceRes.rows[0];

      // Insert line items
      const savedItems = [];
      for (const item of lineItems) {
        const itemSql = `
          INSERT INTO line_items (invoice_id, description, quantity, unit_price, total_amount)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *;
        `;
        const itemRes = await client.query(itemSql, [
          savedInvoice.id,
          item.description || '',
          item.quantity || 1,
          item.unit_price || 0,
          item.total_amount || 0,
        ]);
        savedItems.push(itemRes.rows[0]);
      }

      return {
        ...savedInvoice,
        line_items: savedItems,
      };
    });
  }

  
  // Save validation errors in batch
  async saveValidationErrors(documentId, errors = []) {
    if (!errors.length) return [];

    return await this.withTransaction(async (client) => {
      await client.query(`DELETE FROM validation_errors WHERE document_id = $1;`, [documentId]);

      const savedErrors = [];
      for (const err of errors) {
        const sql = `
          INSERT INTO validation_errors (document_id, field_name, error_type, message, severity)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *;
        `;
        const res = await client.query(sql, [
          documentId,
          err.field_name,
          err.error_type,
          err.message,
          err.severity || 'warning',
        ]);
        savedErrors.push(res.rows[0]);
      }
      return savedErrors;
    });
  }

  
  // Add entry into processing audit history
  async addProcessingHistory(documentId, stage, status, message = '', durationMs = 0) {
    const sql = `
      INSERT INTO processing_history (document_id, stage, status, message, duration_ms)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const res = await this.query(sql, [documentId, stage, status, message, durationMs]);
    return res.rows[0];
  }

  
  // List documents with multi-tenant client isolation
  async listDocuments({ clientId = null, userId = null, role = null, status = null, limit = 20, offset = 0 }) {
    const conditions = [];
    const params = [];

    // Client multi-tenant isolation
    if (role !== APPLICATION_ROLES.SUPER_ADMIN && clientId) {
      params.push(clientId);
      conditions.push(`d.client_id = $${params.length}`);
    } else if (role === APPLICATION_ROLES.SUPER_ADMIN && clientId) {
      // Optional client filter for super admin
      params.push(clientId);
      conditions.push(`d.client_id = $${params.length}`);
    }

    if (userId && role === APPLICATION_ROLES.CLIENT_VIEWER) {
      // Optional: client_viewer can be optionally scoped to their own uploads if desired
    }

    if (status) {
      params.push(status);
      conditions.push(`d.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM documents d ${whereClause};`;
    const countRes = await this.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT 
        d.*, 
        u.name AS owner_name, 
        u.email AS owner_email,
        c.name AS client_name,
        c.slug AS client_slug,
        inv.invoice_number, 
        inv.supplier_name, 
        inv.total AS invoice_total, 
        inv.needs_review
      FROM documents d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN clients c ON c.id = d.client_id
      LEFT JOIN invoices inv ON inv.document_id = d.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const res = await this.query(sql, params);

    return {
      total,
      limit,
      offset,
      documents: res.rows,
    };
  }

  
  // Apply user corrections to invoice data (with tenant verification)
  async applyCorrections(documentId, updates, requestingContext = null) {
    if (requestingContext) {
      await this.findWithDetails(documentId, requestingContext);
    }

    return await this.withTransaction(async (client) => {
      const { line_items, ...invoiceFields } = updates;

      if (Object.keys(invoiceFields).length > 0) {
        const keys = Object.keys(invoiceFields);
        const values = Object.values(invoiceFields);
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const sql = `
          UPDATE invoices
          SET ${setClause}, needs_review = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE document_id = $${keys.length + 1}
          RETURNING *;
        `;
        await client.query(sql, [...values, documentId]);
      }

      if (Array.isArray(line_items)) {
        const invoiceRes = await client.query(`SELECT id FROM invoices WHERE document_id = $1;`, [documentId]);
        if (invoiceRes.rows[0]) {
          const invoiceId = invoiceRes.rows[0].id;
          await client.query(`DELETE FROM line_items WHERE invoice_id = $1;`, [invoiceId]);

          for (const item of line_items) {
            await client.query(
              `INSERT INTO line_items (invoice_id, description, quantity, unit_price, total_amount)
               VALUES ($1, $2, $3, $4, $5);`,
              [invoiceId, item.description, item.quantity, item.unit_price, item.total_amount]
            );
          }
        }
      }

      await client.query(`DELETE FROM validation_errors WHERE document_id = $1;`, [documentId]);

      return await this.findWithDetails(documentId, requestingContext);
    });
  }
}

export default DocumentRepository;
