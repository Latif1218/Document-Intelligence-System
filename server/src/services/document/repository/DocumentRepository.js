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


    const invoiceSql = `SELECT * FROM invoices WHERE document_id = $1 ORDER BY created_at ASC;`;
    const invoiceRes = await this.query(invoiceSql, [documentId]);
    const invoicesRows = invoiceRes.rows;

    const allInvoices = [];
    for (const inv of invoicesRows) {
      const itemsSql = `SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY created_at ASC;`;
      const itemsRes = await this.query(itemsSql, [inv.id]);
      allInvoices.push({
        ...inv,
        line_items: itemsRes.rows,
      });
    }

    const primaryInvoice = allInvoices[0] || null;

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
      invoice: primaryInvoice, // 100% Backward-compatible single invoice
      invoices: allInvoices,   // Full array of all extracted invoices for this document
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


  async saveInvoicesList(documentId, invoicesList = []) {
    return await this.withTransaction(async (client) => {
      // Delete existing invoices for this doc if reprocessing
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

      const insertItemSql = `
        INSERT INTO line_items (invoice_id, description, quantity, unit_price, total_amount)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;

      const savedInvoices = [];

      for (const inv of invoicesList) {
        const invoiceRes = await client.query(insertInvoiceSql, [
          documentId,
          inv.invoice_number || null,
          inv.invoice_date || null,
          inv.supplier_name || null,
          inv.customer_name || null,
          inv.subtotal !== undefined && inv.subtotal !== null ? inv.subtotal : null,
          inv.tax !== undefined && inv.tax !== null ? inv.tax : null,
          inv.total !== undefined && inv.total !== null ? inv.total : null,
          inv.currency || 'USD',
          JSON.stringify(inv.evidence_quotes || {}),
          JSON.stringify(inv.raw_ai_response || {}),
          inv.needs_review || false,
          inv.confidence_score || 1.0,
        ]);

        const savedInvoice = invoiceRes.rows[0];
        const lineItems = Array.isArray(inv.line_items) ? inv.line_items : [];
        const savedItems = [];

        for (const item of lineItems) {
          const itemRes = await client.query(insertItemSql, [
            savedInvoice.id,
            item.description || '',
            item.quantity || 1,
            item.unit_price || 0,
            item.total_amount || 0,
          ]);
          savedItems.push(itemRes.rows[0]);
        }

        savedInvoices.push({
          ...savedInvoice,
          line_items: savedItems,
        });
      }

      return savedInvoices;
    });
  }


  async saveInvoiceAndItems(documentId, invoiceData, lineItems = []) {
    // If invoiceData is an array of invoices
    if (Array.isArray(invoiceData)) {
      const results = await this.saveInvoicesList(documentId, invoiceData);
      return results[0] || null;
    }
    // If invoiceData has invoices list from AI extraction
    if (Array.isArray(invoiceData?.invoices) && invoiceData.invoices.length > 0) {
      const results = await this.saveInvoicesList(documentId, invoiceData.invoices);
      return results[0] || null;
    }

    // Single invoice fallback
    const singleInv = {
      ...invoiceData,
      line_items: lineItems.length > 0 ? lineItems : (invoiceData.line_items || []),
    };
    const results = await this.saveInvoicesList(documentId, [singleInv]);
    return results[0] || null;
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
      const { line_items, invoice_id, ...invoiceFields } = updates;

      // Identify target invoice (specific invoice_id or primary invoice)
      let targetInvoiceId = invoice_id;
      if (!targetInvoiceId) {
        const invRes = await client.query(
          `SELECT id FROM invoices WHERE document_id = $1 ORDER BY created_at ASC LIMIT 1;`,
          [documentId]
        );
        targetInvoiceId = invRes.rows[0]?.id || null;
      }

      if (Object.keys(invoiceFields).length > 0 && targetInvoiceId) {
        const keys = Object.keys(invoiceFields);
        const values = Object.values(invoiceFields);
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const sql = `
          UPDATE invoices
          SET ${setClause}, needs_review = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${keys.length + 1}
          RETURNING *;
        `;
        await client.query(sql, [...values, targetInvoiceId]);
      }

      if (Array.isArray(line_items) && targetInvoiceId) {
        await client.query(`DELETE FROM line_items WHERE invoice_id = $1;`, [targetInvoiceId]);

        for (const item of line_items) {
          await client.query(
            `INSERT INTO line_items (invoice_id, description, quantity, unit_price, total_amount)
             VALUES ($1, $2, $3, $4, $5);`,
            [targetInvoiceId, item.description, item.quantity, item.unit_price, item.total_amount]
          );
        }
      }

      await client.query(`DELETE FROM validation_errors WHERE document_id = $1;`, [documentId]);

      return await this.findWithDetails(documentId, requestingContext);
    });
  }
}

export default DocumentRepository;
