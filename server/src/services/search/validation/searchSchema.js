import { z } from 'zod';


// Validation schema 
export const searchQuerySchema = z.object({
  query: z.object({
    q: z
      .string()
      .min(1, { message: 'Search query string "q" cannot be empty' })
      .max(500, { message: 'Search query string is too long (max 500 characters)' }),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    supplier: z.string().optional(),
    needs_review: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export default {
  searchQuerySchema,
};

