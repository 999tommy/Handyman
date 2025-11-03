const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const config = require('../config/env');
const { UPLOAD_LIMITS, ERROR_CODES } = require('../utils/constants');
const { ValidationError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * File Upload Middleware using Multer
 * 
 * Handles file uploads to Supabase Storage or Cloudinary
 * In Next.js, you might handle uploads in API routes with different libraries
 * In Express, Multer is the standard
 */

/**
 * File filter - only allow images
 */
const fileFilter = (req, file, cb) => {
  if (UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type. Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

/**
 * Multer storage configuration (memory storage for cloud uploads)
 */
const storage = multer.memoryStorage();

/**
 * Base multer configuration
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

/**
 * Upload single file
 */
const uploadSingle = (fieldName) => upload.single(fieldName);

/**
 * Upload multiple files
 */
const uploadMultiple = (fieldName, maxCount) => upload.array(fieldName, maxCount);

/**
 * Upload to Supabase Storage
 * @param {Object|Buffer} file - Multer file object or buffer
 * @param {string} bucket - Supabase bucket name
 * @param {string} userId - Optional user ID for organizing files
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadToSupabase(file, bucket = 'uploads', userId = null) {
  try {
    // Handle both file object and buffer/filename params
    const fileBuffer = file.buffer || file;
    const fileName = file.originalname || file.name || 'file';
    
    // Generate unique filename
    const ext = path.extname(fileName);
    const uniqueName = `${uuidv4()}${ext}`;
    const filePath = userId 
      ? `${userId}/${Date.now()}_${uniqueName}`
      : `${Date.now()}_${uniqueName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype || 'auto',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      logger.error('Supabase upload error:', error);
      throw new Error('File upload failed');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    logger.logError(error, { context: 'uploadToSupabase' });
    throw error;
  }
}

/**
 * Upload to Cloudinary (if configured)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} folder - Cloudinary folder
 * @returns {Promise<string>} Cloudinary URL
 */
async function uploadToCloudinary(fileBuffer, folder = 'handyman') {
  // This requires cloudinary package
  // Implementation depends on your Cloudinary setup
  throw new Error('Cloudinary upload not implemented yet');
}

/**
 * Middleware to upload single file and attach URL to request
 * @param {string} fieldName - Form field name
 * @param {string} bucket - Storage bucket
 */
function handleSingleUpload(fieldName, bucket = 'uploads') {
  return async (req, res, next) => {
    try {
      // First, handle multer upload
      upload.single(fieldName)(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return next(new ValidationError('File size exceeds limit (5MB)'));
            }
          }
          return next(err);
        }

        if (!req.file) {
          return next(); // No file uploaded, continue
        }

        try {
          // Upload to storage
          const url = await uploadToSupabase(req.file.buffer, req.file.originalname, bucket);
          
          // Attach URL to request body
          req.body[`${fieldName}_url`] = url;
          
          logger.debug(`File uploaded: ${url}`);
          next();
        } catch (uploadError) {
          next(new ValidationError('Failed to upload file'));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to upload multiple files
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 * @param {string} bucket - Storage bucket
 */
function handleMultipleUpload(fieldName, maxCount = 5, bucket = 'uploads') {
  return async (req, res, next) => {
    try {
      upload.array(fieldName, maxCount)(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return next(new ValidationError('One or more files exceed size limit (5MB)'));
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return next(new ValidationError(`Maximum ${maxCount} files allowed`));
            }
          }
          return next(err);
        }

        if (!req.files || req.files.length === 0) {
          return next(); // No files uploaded
        }

        try {
          // Upload all files
          const uploadPromises = req.files.map(file =>
            uploadToSupabase(file.buffer, file.originalname, bucket)
          );
          
          const urls = await Promise.all(uploadPromises);
          
          // Attach URLs to request body
          req.body[`${fieldName}_urls`] = urls;
          
          logger.debug(`${urls.length} files uploaded`);
          next();
        } catch (uploadError) {
          next(new ValidationError('Failed to upload one or more files'));
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Delete file from Supabase Storage
 * @param {string} fileUrl - Full URL or path of file
 * @param {string} bucket - Storage bucket
 */
async function deleteFromSupabase(fileUrl, bucket = 'uploads') {
  try {
    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts[pathParts.length - 1];

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      logger.error('Error deleting file:', error);
    }
  } catch (error) {
    logger.logError(error, { context: 'deleteFromSupabase' });
  }
}

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  handleSingleUpload,
  handleMultipleUpload,
  uploadToSupabase,
  uploadToCloudinary,
  deleteFromSupabase,
};
