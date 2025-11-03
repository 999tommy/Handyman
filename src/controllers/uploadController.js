const { asyncHandler } = require('../middleware/errorHandler');
const { uploadToSupabase, deleteFromSupabase } = require('../middleware/upload');
const logger = require('../utils/logger');

/**
 * Upload Controller
 * 
 * Handles file uploads to Supabase Storage
 */

/**
 * Upload profile picture
 * POST /api/upload/profile-picture
 */
const uploadProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded' },
    });
  }

  const bucket = 'profile-pictures';
  const fileUrl = await uploadToSupabase(req.file, bucket, req.user?.id);

  logger.info(`Profile picture uploaded: ${fileUrl}`);

  res.status(200).json({
    success: true,
    data: { url: fileUrl },
  });
});

/**
 * Upload government ID
 * POST /api/upload/government-id
 */
const uploadGovernmentId = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded' },
    });
  }

  const bucket = 'government-ids';
  const fileUrl = await uploadToSupabase(req.file, bucket, req.user?.id);

  logger.info(`Government ID uploaded: ${fileUrl}`);

  res.status(200).json({
    success: true,
    data: { url: fileUrl },
  });
});

/**
 * Upload portfolio image
 * POST /api/upload/portfolio-image
 */
const uploadPortfolioImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded' },
    });
  }

  const bucket = 'portfolio-images';
  const fileUrl = await uploadToSupabase(req.file, bucket, req.user?.id);

  logger.info(`Portfolio image uploaded: ${fileUrl}`);

  res.status(200).json({
    success: true,
    data: { url: fileUrl },
  });
});

/**
 * Upload multiple portfolio images
 * POST /api/upload/portfolio-images
 */
const uploadPortfolioImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'No files uploaded' },
    });
  }

  const bucket = 'portfolio-images';
  const uploadPromises = req.files.map(file => 
    uploadToSupabase(file, bucket, req.user?.id)
  );

  const fileUrls = await Promise.all(uploadPromises);

  logger.info(`${fileUrls.length} portfolio images uploaded`);

  res.status(200).json({
    success: true,
    data: { urls: fileUrls },
  });
});

module.exports = {
  uploadProfilePicture,
  uploadGovernmentId,
  uploadPortfolioImage,
  uploadPortfolioImages,
};
