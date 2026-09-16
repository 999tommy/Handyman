const express = require('express');
const uploadController = require('../controllers/uploadController');
const { uploadFlexible } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * File Upload Route
 * 
 * This endpoint does NOT require authentication
 * They can be called during registration before user is logged in
 */

/**
 * Unified Upload Endpoint
 * POST /api/upload?type=profile_picture|government_id|portfolio_image|portfolio_images|job_photo|job_photos
 */
router.post(
  '/',
  uploadLimiter,
  uploadFlexible,
  uploadController.uploadMedia
);

module.exports = router;
