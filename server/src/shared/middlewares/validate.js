/**
 * Generic Zod Validation Middleware
 * Validates request body, query parameters, and route parameters against a given Zod schema.
 * Replaces unvalidated values with sanitized, strongly-typed parsed values.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 */

const validate = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (error) {
    next(error); // Caught by global errorHandler
  }
};

export default validate;

