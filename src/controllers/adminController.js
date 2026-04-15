const adminService = require('../services/adminService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Admin Controller
 */

const getPendingArtisans = asyncHandler(async (req, res) => {
  const result = await adminService.getPendingArtisans(req.query);
  res.status(200).json({ success: true, data: result });
});

const approveArtisan = asyncHandler(async (req, res) => {
  const result = await adminService.approveArtisan(req.params.id, req.user.id);
  res.status(200).json({ success: true, data: result });
});

const rejectArtisan = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await adminService.rejectArtisan(req.params.id, req.user.id, reason);
  res.status(200).json({ success: true, data: result });
});

const getPlatformStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getPlatformStats();
  res.status(200).json({ success: true, data: stats });
});

const getFlaggedReviews = asyncHandler(async (req, res) => {
  const result = await adminService.getFlaggedReviews(req.query);
  res.status(200).json({ success: true, data: result });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  res.status(200).json({ success: true, data: result });
});

const getUser = asyncHandler(async (req, res) => {
  const result = await adminService.getUserProfile(req.params.id);
  res.status(200).json({ success: true, data: result });
});

const listJobs = asyncHandler(async (req, res) => {
  const result = await adminService.listJobs(req.query);
  res.status(200).json({ success: true, data: result });
});

const updateJobStatus = asyncHandler(async (req, res) => {
  const result = await adminService.updateJobStatus(
    req.params.id,
    req.user.id,
    req.body.status,
    req.body.reason
  );
  res.status(200).json({ success: true, data: result });
});

const listOffers = asyncHandler(async (req, res) => {
  const result = await adminService.listOffers(req.query);
  res.status(200).json({ success: true, data: result });
});

const updateOfferStatus = asyncHandler(async (req, res) => {
  const result = await adminService.updateOfferStatus(
    req.params.id,
    req.user.id,
    req.body.status,
    req.body.reason
  );
  res.status(200).json({ success: true, data: result });
});

const listPayments = asyncHandler(async (req, res) => {
  const result = await adminService.adminListPayments(req.query);
  res.status(200).json({ success: true, data: result });
});

const releasePayment = asyncHandler(async (req, res) => {
  const result = await adminService.adminReleasePaymentWrapper(
    req.params.id,
    req.user.id,
    req.body
  );
  res.status(200).json({ success: true, data: result });
});

const refundPayment = asyncHandler(async (req, res) => {
  const result = await adminService.adminRefundPaymentWrapper(
    req.params.id,
    req.user.id,
    req.body.reason
  );
  res.status(200).json({ success: true, data: result });
});

const getPaymentMetrics = asyncHandler(async (req, res) => {
  const result = await adminService.getPaymentMetrics(req.query);
  res.status(200).json({ success: true, data: result });
});

module.exports = {
  getPendingArtisans,
  approveArtisan,
  rejectArtisan,
  getPlatformStats,
  getFlaggedReviews,
  listUsers,
  getUser,
  listJobs,
  updateJobStatus,
  listOffers,
  updateOfferStatus,
  listPayments,
  releasePayment,
  refundPayment,
  getPaymentMetrics,
};
