export const INVOICE_EXTRACTION_SYSTEM_PROMPT = `
You are an expert Document Intelligence and Financial Data Extraction AI.
Your task is to accurately extract financial invoice details from the provided document text, table, or OCR transcription.

CRITICAL INSTRUCTIONS & ANTI-HALLUCINATION RULES:
1. Extract ONLY facts explicitly stated in the document.
2. If any field (e.g. tax, customer_name, subtotal) is missing, not mentioned, or uncertain, YOU MUST SET ITS VALUE TO NULL.
3. NEVER invent, extrapolate, or guess values under any circumstance.
4. For every extracted field, provide an "evidence_quote" containing the exact, verbatim text snippet from the document where the value was found.
5. Dates MUST be formatted as YYYY-MM-DD. If only partial date is available, extract what is visible.
6. Numeric values (subtotal, tax, total, quantity, unit_price, total_amount) must be pure numbers without currency symbols (e.g., 1250.50, not "$1,250.50").
7. Line items MUST strictly belong to their respective invoice: ensure all line items are extracted with their descriptions, quantities, unit prices, and line totals.

MULTI-INVOICE BATCH & SPREADSHEET HANDLING:
8. SINGLE INVOICE: If the document is a standard invoice (PDF, scan, image) representing a single billing transaction, set document_type to "single_invoice" and return exactly ONE invoice object inside the "invoices" array.
9. MULTI-INVOICE BATCH (CSV / Excel / Ledger):
   - If the document contains multiple distinct invoices (e.g., a CSV or spreadsheet where rows represent different invoice numbers, different suppliers, or multiple billing transactions):
   - Set document_type to "multi_invoice_batch".
   - GROUP line items by their respective invoice number or supplier.
   - For EACH distinct invoice, create a separate invoice object in the "invoices" array with its own invoice_number, invoice_date, supplier_name, customer_name, subtotal, tax, total, currency, and its own line_items.
   - Do NOT combine different invoices into one or set their metadata to null. Treat each distinct invoice in the batch with complete fidelity.
`;


export const INVOICE_JSON_SCHEMA = {
  name: 'invoice_batch_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      document_type: {
        type: 'string',
        enum: ['single_invoice', 'multi_invoice_batch'],
        description: "Classification: 'single_invoice' if document represents one invoice, or 'multi_invoice_batch' if it contains a table of multiple distinct invoices",
      },
      invoices: {
        type: 'array',
        description: 'List of invoices extracted from the document. Contains 1 item for standard documents, or multiple items for batch CSVs/statements.',
        items: {
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
              description: 'Subtotal amount before taxes or discounts for this invoice',
            },
            tax: {
              type: ['number', 'null'],
              description: 'Total tax, VAT, or GST amount for this invoice',
            },
            total: {
              type: ['number', 'null'],
              description: 'Final total payable amount for this invoice',
            },
            currency: {
              type: ['string', 'null'],
              description: 'Three-letter currency code (e.g., USD, EUR, GBP, BDT) or symbol',
            },
            line_items: {
              type: 'array',
              description: 'List of individual line items belonging specifically to this invoice',
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
              description: 'Verbatim quotes from the document supporting each extracted field for this invoice',
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
              description: 'Self-estimated extraction confidence score between 0.0 and 1.0 for this invoice',
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
      },
    },
    required: ['document_type', 'invoices'],
    additionalProperties: false,
  },
};

export default {
  INVOICE_EXTRACTION_SYSTEM_PROMPT,
  INVOICE_JSON_SCHEMA,
};
