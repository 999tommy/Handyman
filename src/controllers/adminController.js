const adminService = require('../services/adminService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Admin Controller
 */

/**
 * Get pending artisans
 * GET /api/admin/artisans/pending
 */
const getPendingArtisans = asyncHandler(async (req, res) => {
  const result = await adminService.getPendingArtisans(req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Approve artisan
 * POST /api/admin/artisans/:id/approve
 */
const approveArtisan = asyncHandler(async (req, res) => {
  const result = await adminService.approveArtisan(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Reject artisan
 * POST /api/admin/artisans/:id/reject
 */
const rejectArtisan = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await adminService.rejectArtisan(req.params.id, req.user.id, reason);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get platform statistics
 * GET /api/admin/stats
 */
const getPlatformStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getPlatformStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Get flagged reviews
 * GET /api/admin/reviews/flagged
 */
const getFlaggedReviews = asyncHandler(async (req, res) => {
  const result = await adminService.getFlaggedReviews(req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getPendingArtisans,
  approveArtisan,
  rejectArtisan,
  getPlatformStats,
  getFlaggedReviews,
};
