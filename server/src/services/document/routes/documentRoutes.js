import { Router } from 'express';
import { documentController } from '../Dependencies/dependencies.js';
import upload from '../../../shared/middlewares/upload.js';
import validate from '../../../shared/middlewares/validate.js';
import authenticate from '../../../shared/middlewares/authenticate.js';
import validateApiKey from '../../../shared/middlewares/validateApiKey.js';
import {
  documentIdParamSchema,
  listDocumentsQuerySchema,
  applyCorrectionSchema,
} from '../validation/documentSchema.js';

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

// Protect all document routes through authentication gate
router.use(authGate);


// Upload multiple files (PDF, JPG, PNG, TIFF, XLSX, XLS, CSV)
router.post(
  '/',
  upload.array('files', 20),
  documentController.upload
);


// List processed documents with status filter and pagination (User isolated or Admin full view)
router.get(
  '/',
  validate(listDocumentsQuerySchema),
  documentController.list
);


// Get the current progress/status of a specific document

router.get(
  '/:id/status',
  validate(documentIdParamSchema),
  documentController.getStatus
);


// Get the extracted invoice details, line items, and audit history
router.get(
  '/:id/results',
  validate(documentIdParamSchema),
  documentController.getResults
);


// Update fields and line items after manual review
router.patch(
  '/:id/corrections',
  validate(applyCorrectionSchema),
  documentController.applyCorrections
);


// Reprocess a failed or modified document through the background pipeline
router.post(
  '/:id/reprocess',
  validate(documentIdParamSchema),
  documentController.reprocess
);


// Server-Sent Events (SSE) stream for live progress tracking
router.get(
  '/:id/events',
  validate(documentIdParamSchema),
  documentController.streamEvents
);

export default router;
