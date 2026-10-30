import Decimal from 'decimal.js';
import postgres from '../../shared/config/postgres.js';
import logger from '../../shared/config/logger.js';


// ValidationEngine

class ValidationEngine {
  constructor(db = postgres) {
    this.db = db;
    // Allow slight rounding tolerance $0.05 for currency rounding variations
    this.tolerance = new Decimal(0.05);
  }

  /**
   * Run full validation suite on extracted invoice data
   * @param {Object} extractedData - Output from AI extraction service
   * @param {string} currentDocumentId - Document UUID to exclude in duplicate checks
   * @param {string} rawDocumentText - Complete raw text for evidence verification
   */
  async validate(extractedData, currentDocumentId, rawDocumentText = '') {
    const errors = [];
    let needsReview = false;

    // Check Missing Mandatory Fields
    const mandatoryFields = [
      { key: 'invoice_number', label: 'Invoice Number' },
      { key: 'invoice_date', label: 'Invoice Date' },
      { key: 'supplier_name', label: 'Supplier Name' },
      { key: 'total', label: 'Total Amount' },
    ];

    for (const field of mandatoryFields) {
      if (!extractedData[field.key] || String(extractedData[field.key]).trim() === '') {
        errors.push({
          field_name: field.key,
          error_type: 'MISSING_FIELD',
          message: `Mandatory field "${field.label}" is missing or could not be determined.`,
          severity: 'error',
        });
        needsReview = true;
      }
    }

    // Check Negative Numeric Values
    const numericFields = ['subtotal', 'tax', 'total'];
    for (const numField of numericFields) {
      if (extractedData[numField] !== null && extractedData[numField] !== undefined) {
        if (extractedData[numField] < 0) {
          errors.push({
            field_name: numField,
            error_type: 'NEGATIVE_VALUE',
            message: `Field "${numField}" cannot have a negative value (${extractedData[numField]}).`,
            severity: 'error',
          });
          needsReview = true;
        }
      }
    }

    // Line Items Mathematical Consistency
    if (Array.isArray(extractedData.line_items) && extractedData.line_items.length > 0) {
      let sumOfItems = new Decimal(0);

      extractedData.line_items.forEach((item, index) => {
        const qty = new Decimal(item.quantity || 1);
        const price = new Decimal(item.unit_price || 0);
        const expectedTotal = qty.times(price);
        const actualTotal = new Decimal(item.total_amount || 0);

        // Check if quantity * unit_price == total_amount
        if (qty.gt(0) && price.gt(0) && expectedTotal.minus(actualTotal).abs().gt(this.tolerance)) {
          errors.push({
            field_name: `line_items[${index}]`,
            error_type: 'LINE_ITEM_MATH_MISMATCH',
            message: `Line item "${item.description || index + 1}" math mismatch: ${qty} x ${price} != ${actualTotal}.`,
            severity: 'warning',
          });
          needsReview = true;
        }

        sumOfItems = sumOfItems.plus(actualTotal);
      });

      // Check sum(line_items) vs subtotal (or total if no subtotal)
      const benchmarkAmount = extractedData.subtotal !== null && extractedData.subtotal !== undefined
        ? new Decimal(extractedData.subtotal)
        : (extractedData.total ? new Decimal(extractedData.total) : null);

      if (benchmarkAmount && sumOfItems.minus(benchmarkAmount).abs().gt(this.tolerance)) {
        errors.push({
          field_name: 'line_items_sum',
          error_type: 'LINE_ITEMS_SUM_MISMATCH',
          message: `Sum of line items (${sumOfItems.toFixed(2)}) does not equal subtotal/total (${benchmarkAmount.toFixed(2)}).`,
          severity: 'warning',
        });
        needsReview = true;
      }
    }

    // Financial Equation Check: Subtotal + Tax = Total
    if (
      extractedData.subtotal !== null &&
      extractedData.subtotal !== undefined &&
      extractedData.tax !== null &&
      extractedData.tax !== undefined &&
      extractedData.total !== null &&
      extractedData.total !== undefined
    ) {
      const subtotal = new Decimal(extractedData.subtotal);
      const tax = new Decimal(extractedData.tax);
      const total = new Decimal(extractedData.total);
      const calculatedTotal = subtotal.plus(tax);

      if (calculatedTotal.minus(total).abs().gt(this.tolerance)) {
        errors.push({
          field_name: 'financial_calculation',
          error_type: 'TOTAL_MISMATCH',
          message: `Financial mismatch: Subtotal (${subtotal.toFixed(2)}) + Tax (${tax.toFixed(2)}) = ${calculatedTotal.toFixed(2)}, but document states Total is ${total.toFixed(2)}.`,
          severity: 'error',
        });
        needsReview = true;
      }
    }

    // Duplicate Invoice Detection
    if (extractedData.invoice_number && extractedData.supplier_name) {
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
        extractedData.invoice_number,
        extractedData.supplier_name,
        currentDocumentId,
      ]);

      if (duplicateRes.rows.length > 0) {
        const dup = duplicateRes.rows[0];
        errors.push({
          field_name: 'invoice_number',
          error_type: 'DUPLICATE_INVOICE',
          message: `Potential duplicate invoice detected. Matches document "${dup.original_filename}" (Total: ${dup.total}, Date: ${dup.invoice_date}).`,
          severity: 'error',
        });
        needsReview = true;
      }
    }

    // Evidence Quote Verification
    if (extractedData.evidence_quotes && rawDocumentText) {
      const rawLower = rawDocumentText.toLowerCase();
      for (const [field, quote] of Object.entries(extractedData.evidence_quotes)) {
        if (quote && typeof quote === 'string') {
          // If the quoted evidence does not exist anywhere in the raw text
          if (!rawLower.includes(quote.toLowerCase().trim())) {
            errors.push({
              field_name: `evidence_${field}`,
              error_type: 'UNVERIFIED_EVIDENCE',
              message: `Quoted evidence for "${field}" could not be confirmed in raw document text.`,
              severity: 'warning',
            });
            needsReview = true;
          }
        }
      }
    }

    logger.info(`Validation completed for document ${currentDocumentId}`, {
      needsReview,
      errorCount: errors.length,
    });

    return {
      isValid: errors.filter((e) => e.severity === 'error').length === 0,
      needsReview,
      errors,
    };
  }
}

export default new ValidationEngine();

