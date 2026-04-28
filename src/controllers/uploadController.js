const { asyncHandler } = require('../middleware/errorHandler');
const { uploadToSupabase } = require('../middleware/upload');
const logger = require('../utils/logger');

/**
 * Upload Controller
 * 
 * Handles file uploads to Supabase Storage
 */

/**
 * Unified Upload Media Endpoint
 * POST /api/upload?type=...
 */
const uploadMedia = asyncHandler(async (req, res) => {
  const { type } = req.query;

  // Validate type
  const allowedTypes = {
    'profile_picture': 'profile-pictures',
    'government_id': 'government-ids',
    'portfolio_image': 'portfolio-images', // single
    'portfolio_images': 'portfolio-images' // multiple
  };

  const bucket = allowedTypes[type];

  if (!bucket) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid or missing "type" query parameter. Valid types are: profile_picture, government_id, portfolio_image, portfolio_images' },
    });
  }

  // Handle multiple files
  if (type === 'portfolio_images') {
    const files = req.files && req.files['files'] ? req.files['files'] : null;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No files uploaded. Ensure you are sending files under the "files" form field.' },
      });
    }

    const uploadPromises = files.map(file => 
      uploadToSupabase(file, bucket, req.user?.id)
    );

    const fileUrls = await Promise.all(uploadPromises);

    logger.info(`${fileUrls.length} ${type} uploaded`);

    return res.status(200).json({
      success: true,
      data: { urls: fileUrls },
    });
  }

  // Handle single file
  // multer `.fields()` puts files in req.files object, `.single()` puts it in req.file
  const file = req.files && req.files['file'] ? req.files['file'][0] : (req.file ? req.file : null);

  if (!file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded. Ensure you are sending the file under the "file" form field.' },
    });
  }

  const fileUrl = await uploadToSupabase(file, bucket, req.user?.id);

  logger.info(`${type} uploaded: ${fileUrl}`);

  res.status(200).json({
    success: true,
    data: { url: fileUrl },
  });
});

module.exports = {
  uploadMedia,
};
