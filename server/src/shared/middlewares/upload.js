import multer from 'multer';
import path from 'path';
import config from '../config/index.js';
import AppError from '../utils/AppError.js';

/**
 * In-memory storage for high-speed streaming directly into MinIO S3
 */
const storage = multer.memoryStorage();

/**
 * File filter to ensure only authorized document formats are accepted:
 * PDF, JPG, PNG, TIFF, XLSX, XLS, and CSV
 */
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();

  const isAllowedExt = allowedExtensions.includes(ext);
  const isAllowedMime = config.upload.allowedMimeTypes.includes(file.mimetype) ||
    file.mimetype === 'text/plain' || // Some systems send CSV as text/plain
    file.mimetype === 'application/csv';

  if (isAllowedExt || isAllowedMime) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Unsupported file type: "${file.originalname}". Only PDF, JPG, PNG, TIFF, XLSX, XLS, and CSV files are allowed.`,
        400
      ),
      false
    );
  }
};

/**
 * Configured Multer instance with file size limit and memory buffer
 */
export const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
  },
  fileFilter,
});

export default upload;

