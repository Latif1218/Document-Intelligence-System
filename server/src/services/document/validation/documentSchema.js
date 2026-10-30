import { z } from 'zod';


// Validation schema for routes requiring a document UUID parameter
export const documentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid document ID. Must be a valid UUID' }),
  }),
});


// Validation schema for listing documents with pagination & filtering
export const listDocumentsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});


// Validation schema for applying manual review corrections
export const applyCorrectionSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid document ID. Must be a valid UUID' }),
  }),
  body: z.object({
    invoice_number: z.string().optional(),
    invoice_date: z.string().optional(),
    supplier_name: z.string().optional(),
    customer_name: z.string().optional(),
    subtotal: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),
    currency: z.string().max(10).optional(),
    line_items: z
      .array(
        z.object({
          description: z.string().default(''),
          quantity: z.number().nonnegative().default(1),
          unit_price: z.number().nonnegative().default(0),
          total_amount: z.number().nonnegative().default(0),
        })
      )
      .optional(),
  }),
});

