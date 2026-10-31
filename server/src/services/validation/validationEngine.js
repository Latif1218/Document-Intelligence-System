import Decimal from 'decimal.js';
import postgres from '../../shared/config/postgres.js';
import logger from '../../shared/config/logger.js';


class ValidationEngine {
  constructor(db = postgres) {
    this.db = db;
    // Allow slight rounding tolerance for currency rounding variations
    this.tolerance = new Decimal(0.05);
  }

  
  // Run validation on an individual invoice object
  async _validateInvoice(invoice, currentDocumentId, rawDocumentText = '', index = 0, isBatch = false) {
    const errors = [];
    let needsReview = false;
    const prefix = isBatch ? `[Invoice #${invoice.invoice_number || index + 1}] ` : '';

    // Check Missing Mandatory Fields
    const mandatoryFields = [
      { key: 'invoice_number', label: 'Invoice Number' },
      { key: 'invoice_date', label: 'Invoice Date' },
      { key: 'supplier_name', label: 'Supplier Name' },
      { key: 'total', label: 'Total Amount' },
    ];

    for (const field of mandatoryFields) {
      if (!invoice[field.key] || String(invoice[field.key]).trim() === '') {
        errors.push({
          field_name: isBatch ? `invoices[${index}].${field.key}` : field.key,
          error_type: 'MISSING_FIELD',
          message: `${prefix}Mandatory field "${field.label}" is missing or could not be determined.`,
          severity: 'error',
        });
        needsReview = true;
      }
    }

    // Check Negative Numeric Values
    const numericFields = ['subtotal', 'tax', 'total'];
    for (const numField of numericFields) {
      if (invoice[numField] !== null && invoice[numField] !== undefined) {
        if (Number(invoice[numField]) < 0) {
          errors.push({
            field_name: isBatch ? `invoices[${index}].${numField}` : numField,
            error_type: 'NEGATIVE_VALUE',
            message: `${prefix}Field "${numField}" cannot have a negative value (${invoice[numField]}).`,
            severity: 'error',
          });
          needsReview = true;
        }
      }
    }

    // Line Items Mathematical Consistency
    if (Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
      let sumOfItems = new Decimal(0);

      invoice.line_items.forEach((item, itemIdx) => {
        const qty = new Decimal(item.quantity || 1);
        const price = new Decimal(item.unit_price || 0);
        const expectedTotal = qty.times(price);
        const actualTotal = new Decimal(item.total_amount || 0);

        // Check if quantity * unit_price == total_amount
        if (qty.gt(0) && price.gt(0) && expectedTotal.minus(actualTotal).abs().gt(this.tolerance)) {
          errors.push({
            field_name: isBatch ? `invoices[${index}].line_items[${itemIdx}]` : `line_items[${itemIdx}]`,
            error_type: 'LINE_ITEM_MATH_MISMATCH',
            message: `${prefix}Line item "${item.description || itemIdx + 1}" math mismatch: ${qty} x ${price} != ${actualTotal}.`,
            severity: 'warning',
          });
          needsReview = true;
        }

        sumOfItems = sumOfItems.plus(actualTotal);
      });

      // Check sum(line_items) vs subtotal (or total if no subtotal)
      const benchmarkAmount =
        invoice.subtotal !== null && invoice.subtotal !== undefined
          ? new Decimal(invoice.subtotal)
          : invoice.total ? new Decimal(invoice.total) : null;

      if (benchmarkAmount && sumOfItems.minus(benchmarkAmount).abs().gt(this.tolerance)) {
        errors.push({
          field_name: isBatch ? `invoices[${index}].line_items_sum` : 'line_items_sum',
          error_type: 'LINE_ITEMS_SUM_MISMATCH',
          message: `${prefix}Sum of line items (${sumOfItems.toFixed(2)}) does not equal subtotal/total (${benchmarkAmount.toFixed(2)}).`,
          severity: 'warning',
        });
        needsReview = true;
      }
    }

    // Financial Equation Check: Subtotal + Tax = Total
    if (
      invoice.subtotal !== null &&
      invoice.subtotal !== undefined &&
      invoice.tax !== null &&
      invoice.tax !== undefined &&
      invoice.total !== null &&
      invoice.total !== undefined
    ) {
      const subtotal = new Decimal(invoice.subtotal);
      const tax = new Decimal(invoice.tax);
      const total = new Decimal(invoice.total);
      const calculatedTotal = subtotal.plus(tax);

      if (calculatedTotal.minus(total).abs().gt(this.tolerance)) {
        errors.push({
          field_name: isBatch ? `invoices[${index}].financial_calculation` : 'financial_calculation',
          error_type: 'TOTAL_MISMATCH',
          message: `${prefix}Financial mismatch: Subtotal (${subtotal.toFixed(2)}) + Tax (${tax.toFixed(2)}) = ${calculatedTotal.toFixed(2)}, but document states Total is ${total.toFixed(2)}.`,
          severity: 'error',
        });
        needsReview = true;
      }
    }

    // Duplicate Invoice Detection
    if (invoice.invoice_number && invoice.supplier_name) {
      const duplicateSql = `
        SELECT inv.id, inv.document_id, d.original_filename, inv.invoice_date, inv.total
        FROM invoices inv
        JOIN documents d ON d.id = inv.document_id
        WHERE inv.invoice_number = $1
          AND inv.supplier_name ILIKE $2
          AND inv.document_id != $3
        LIMIT 1;
      `;
      const duplicateRes = await this.db.query(duplicateSql, [
        invoice.invoice_number,
        invoice.supplier_name,
        currentDocumentId,
      ]);

      if (duplicateRes.rows.length > 0) {
        const dup = duplicateRes.rows[0];
        errors.push({
          field_name: isBatch ? `invoices[${index}].invoice_number` : 'invoice_number',
          error_type: 'DUPLICATE_INVOICE',
          message: `${prefix}Potential duplicate invoice detected. Matches document "${dup.original_filename}" (Total: ${dup.total}, Date: ${dup.invoice_date}).`,
          severity: 'error',
        });
        needsReview = true;
      }
    }

    // Evidence Quote Verification
    if (invoice.evidence_quotes && rawDocumentText) {
      const rawLower = rawDocumentText.toLowerCase();
      for (const [field, quote] of Object.entries(invoice.evidence_quotes)) {
        if (quote && typeof quote === 'string') {
          if (!rawLower.includes(quote.toLowerCase().trim())) {
            errors.push({
              field_name: isBatch ? `invoices[${index}].evidence_${field}` : `evidence_${field}`,
              error_type: 'UNVERIFIED_EVIDENCE',
              message: `${prefix}Quoted evidence for "${field}" could not be confirmed in raw document text.`,
              severity: 'warning',
            });
            needsReview = true;
          }
        }
      }
    }

    return { errors, needsReview };
  }

  /**
   * Run full validation suite on extracted data (handles both single & multi-invoice batch)
   * @param {Object} extractedData - Output from AI extraction service
   * @param {string} currentDocumentId - Document UUID to exclude in duplicate checks
   * @param {string} rawDocumentText - Complete raw text for evidence verification
   */
  async validate(extractedData, currentDocumentId, rawDocumentText = '') {
    const allErrors = [];
    let overallNeedsReview = false;

    // Check if multi-invoice batch or single invoice
    const invoicesList = Array.isArray(extractedData?.invoices) && extractedData.invoices.length > 0
      ? extractedData.invoices
      : [extractedData];

    const isBatch = invoicesList.length > 1;

    for (let i = 0; i < invoicesList.length; i++) {
      const { errors, needsReview } = await this._validateInvoice(
        invoicesList[i],
        currentDocumentId,
        rawDocumentText,
        i,
        isBatch
      );
      if (errors.length > 0) {
        allErrors.push(...errors);
      }
      if (needsReview) {
        overallNeedsReview = true;
      }
    }

    logger.info(`Validation completed for document ${currentDocumentId}`, {
      invoicesValidated: invoicesList.length,
      needsReview: overallNeedsReview,
      errorCount: allErrors.length,
    });

    return {
      isValid: allErrors.filter((e) => e.severity === 'error').length === 0,
      needsReview: overallNeedsReview,
      errors: allErrors,
    };
  }
}

export default new ValidationEngine();
