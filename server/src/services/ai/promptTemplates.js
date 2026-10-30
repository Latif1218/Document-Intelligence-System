export const INVOICE_EXTRACTION_SYSTEM_PROMPT = `
You are an expert Document Intelligence and Financial Data Extraction AI.
Your task is to accurately extract invoice details from the provided document text or OCR transcription.

CRITICAL INSTRUCTIONS & ANTI-HALLUCINATION RULES:
1. Extract ONLY facts explicitly stated in the document.
2. If any field (e.g. tax, customer_name, subtotal) is missing, not mentioned, or uncertain, YOU MUST SET ITS VALUE TO NULL.
3. NEVER invent, extrapolate, or guess values under any circumstance.
4. For every extracted field, provide an "evidence_quote" containing the exact, verbatim text snippet from the document where the value was found.
5. Dates MUST be formatted as YYYY-MM-DD. If only partial date is available, extract what is visible.
6. Numeric values (subtotal, tax, total, quantity, unit_price, total_amount) must be pure numbers without currency symbols (e.g., 1250.50, not "$1,250.50").
7. Ensure all line items are extracted with their descriptions, quantities, unit prices, and line totals. If a table has multiple items, extract each individually.
`;

/**
 * Strict JSON Schema definition for Structured Outputs
 */
export const INVOICE_JSON_SCHEMA = {
  name: 'invoice_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      invoice_number: {
        type: ['string', 'null'],
        description: 'The unique identification or reference number of the invoice',
      },
      invoice_date: {
        type: ['string', 'null'],
        description: 'The issue date of the invoice in YYYY-MM-DD format',
      },
      supplier_name: {
        type: ['string', 'null'],
        description: 'Name of the vendor, seller, or issuing organization',
      },
      customer_name: {
        type: ['string', 'null'],
        description: 'Name of the client, customer, or recipient organization/person',
      },
      subtotal: {
        type: ['number', 'null'],
        description: 'Subtotal amount before taxes or discounts',
      },
      tax: {
        type: ['number', 'null'],
        description: 'Total tax, VAT, or GST amount',
      },
      total: {
        type: ['number', 'null'],
        description: 'Final total payable amount',
      },
      currency: {
        type: ['string', 'null'],
        description: 'Three-letter currency code (e.g., USD, EUR, GBP, BDT) or symbol',
      },
      line_items: {
        type: 'array',
        description: 'List of individual line items, products, or services billed',
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Item or service description',
            },
            quantity: {
              type: 'number',
              description: 'Quantity or hours billed',
            },
            unit_price: {
              type: 'number',
              description: 'Unit price per quantity',
            },
            total_amount: {
              type: 'number',
              description: 'Total price for this line item',
            },
          },
          required: ['description', 'quantity', 'unit_price', 'total_amount'],
          additionalProperties: false,
        },
      },
      evidence_quotes: {
        type: 'object',
        description: 'Verbatim quotes from the document supporting each extracted field',
        properties: {
          invoice_number: { type: ['string', 'null'] },
          invoice_date: { type: ['string', 'null'] },
          supplier_name: { type: ['string', 'null'] },
          customer_name: { type: ['string', 'null'] },
          total: { type: ['string', 'null'] },
        },
        required: ['invoice_number', 'invoice_date', 'supplier_name', 'customer_name', 'total'],
        additionalProperties: false,
      },
      confidence_score: {
        type: 'number',
        description: 'Self-estimated overall extraction confidence score between 0.0 and 1.0',
      },
    },
    required: [
      'invoice_number',
      'invoice_date',
      'supplier_name',
      'customer_name',
      'subtotal',
      'tax',
      'total',
      'currency',
      'line_items',
      'evidence_quotes',
      'confidence_score',
    ],
    additionalProperties: false,
  },
};

export default {
  INVOICE_EXTRACTION_SYSTEM_PROMPT,
  INVOICE_JSON_SCHEMA,
};

