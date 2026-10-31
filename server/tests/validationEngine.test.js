import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import validationEngine from '../src/services/validation/validationEngine.js';

describe('ValidationEngine Test Suite', () => {
  // Mock DB to prevent external network calls during unit tests
  const mockDb = {
    query: async () => ({ rows: [] }),
  };
  validationEngine.db = mockDb;

  it('should pass a perfectly consistent invoice', async () => {
    const validInvoice = {
      invoice_number: 'INV-2026-001',
      invoice_date: '2026-05-15',
      supplier_name: 'Acme Cloud Solutions',
      customer_name: 'Care Guide Corp',
      subtotal: 1000.0,
      tax: 150.0,
      total: 1150.0,
      currency: 'USD',
      line_items: [
        {
          description: 'Server Cloud Hosting',
          quantity: 2,
          unit_price: 500.0,
          total_amount: 1000.0,
        },
      ],
      evidence_quotes: {
        invoice_number: 'INV-2026-001',
        supplier_name: 'Acme Cloud Solutions',
      },
    };

    const rawText = 'Invoice: INV-2026-001 from Acme Cloud Solutions for Care Guide Corp. Total: $1150.00';
    const result = await validationEngine.validate(validInvoice, 'doc-uuid-1', rawText);

    assert.equal(result.isValid, true);
    assert.equal(result.needsReview, false);
    assert.equal(result.errors.length, 0);
  });

  it('should flag financial equation mismatch (subtotal + tax != total)', async () => {
    const invalidMathInvoice = {
      invoice_number: 'INV-2026-002',
      invoice_date: '2026-05-15',
      supplier_name: 'Tech Suppliers Ltd',
      customer_name: 'Client',
      subtotal: 1000.0,
      tax: 100.0,
      total: 1200.0, // Expected 1100.0, mismatched by 100
      currency: 'USD',
      line_items: [],
      evidence_quotes: {},
    };

    const result = await validationEngine.validate(invalidMathInvoice, 'doc-uuid-2', 'Sample text');

    assert.equal(result.isValid, false);
    assert.equal(result.needsReview, true);
    const mathError = result.errors.find((e) => e.error_type === 'TOTAL_MISMATCH');
    assert.ok(mathError);
  });

  it('should flag missing mandatory fields', async () => {
    const incompleteInvoice = {
      invoice_number: '', // Missing
      invoice_date: null, // Missing
      supplier_name: '', // Missing
      subtotal: 50.0,
      tax: 5.0,
      total: 55.0,
    };

    const result = await validationEngine.validate(incompleteInvoice, 'doc-uuid-3', '');

    assert.equal(result.isValid, false);
    assert.equal(result.needsReview, true);
    const missingFields = result.errors.filter((e) => e.error_type === 'MISSING_FIELD');
    assert.equal(missingFields.length, 3);
  });

  it('should flag negative financial amounts', async () => {
    const negativeInvoice = {
      invoice_number: 'INV-004',
      invoice_date: '2026-01-01',
      supplier_name: 'Vendor',
      subtotal: 100.0,
      tax: -15.0, // Negative tax
      total: 85.0,
    };

    const result = await validationEngine.validate(negativeInvoice, 'doc-uuid-4', '');

    assert.equal(result.isValid, false);
    assert.equal(result.needsReview, true);
    const negError = result.errors.find((e) => e.error_type === 'NEGATIVE_VALUE');
    assert.ok(negError);
  });

  it('should flag unverified evidence quotes not found in raw text', async () => {
    const hallucinatedEvidenceInvoice = {
      invoice_number: 'INV-999',
      invoice_date: '2026-01-01',
      supplier_name: 'Real Supplier',
      subtotal: 100.0,
      tax: 10.0,
      total: 110.0,
      evidence_quotes: {
        invoice_number: 'Fictional Quote 12345 Never in text',
      },
    };

    const rawText = 'Real document containing Real Supplier and invoice INV-999';
    const result = await validationEngine.validate(hallucinatedEvidenceInvoice, 'doc-uuid-5', rawText);

    assert.equal(result.needsReview, true);
    const evidenceError = result.errors.find((e) => e.error_type === 'UNVERIFIED_EVIDENCE');
    assert.ok(evidenceError);
  });
});

