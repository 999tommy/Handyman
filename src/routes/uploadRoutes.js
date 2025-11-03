const express = require('express');
const uploadController = require('../controllers/uploadController');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * File Upload Routes
 * 
 * These endpoints do NOT require authentication
 * They can be called during registration before user is logged in
 */

/**
 * Upload profile picture
 * POST /api/upload/profile-picture
 */
router.post(
  '/profile-picture',
  uploadLimiter,
  uploadSingle('file'),
  uploadController.uploadProfilePicture
);

/**
 * Upload government ID
 * POST /api/upload/government-id
 */
router.post(
  '/government-id',
  uploadLimiter,
  uploadSingle('file'),
  uploadController.uploadGovernmentId
);

/**
 * Upload single portfolio image
 * POST /api/upload/portfolio-image
 */
router.post(
  '/portfolio-image',
  uploadLimiter,
  uploadSingle('file'),
  uploadController.uploadPortfolioImage
);

/**
 * Upload multiple portfolio images
 * POST /api/upload/portfolio-images
 */
router.post(
  '/portfolio-images',
  uploadLimiter,
  uploadMultiple('files', 10), // Max 10 images
  uploadController.uploadPortfolioImages
);

module.exports = router;
