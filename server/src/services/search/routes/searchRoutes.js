import { Router } from 'express';
import { searchController } from '../Dependencies/dependencies.js';
import validate from '../../../shared/middlewares/validate.js';
import authenticate from '../../../shared/middlewares/authenticate.js';
import validateApiKey from '../../../shared/middlewares/validateApiKey.js';
import { searchQuerySchema } from '../validation/searchSchema.js';

const router = Router();


// Flexible Authentication Gate
const authGate = (req, res, next) => {
  const hasToken =
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) ||
    (req.cookies && (req.cookies.authToken || req.cookies.token)) ||
    (req.query && req.query.token);

  if (hasToken) {
    return authenticate(req, res, next);
  }
  return validateApiKey(req, res, next);
};

// Protect search endpoints through flexible authentication gate
router.use(authGate);


// Keyword + Semantic Hybrid Search
router.get(
  '/',
  validate(searchQuerySchema),
  searchController.search
);

export default router;
