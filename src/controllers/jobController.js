const jobService = require('../services/jobService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Job Controller
 */

/**
 * Create job
 * POST /api/jobs
 */
const createJob = asyncHandler(async (req, res) => {
  const job = await jobService.createJob(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: job,
  });
});

/**
 * Get job details
 * GET /api/jobs/:id
 */
const getJob = asyncHandler(async (req, res) => {
  const job = await jobService.getJobById(req.params.id, req.user?.id);

  res.status(200).json({
    success: true,
    data: job,
  });
});

/**
 * Get customer's jobs
 * GET /api/jobs/my-jobs
 */
const getMyJobs = asyncHandler(async (req, res) => {
  const result = await jobService.getCustomerJobs(req.user.id, req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Browse jobs (artisan)
 * GET /api/jobs/browse
 */
const browseJobs = asyncHandler(async (req, res) => {
  const result = await jobService.browseJobs(req.user.id, req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Update job
 * PATCH /api/jobs/:id
 */
const updateJob = asyncHandler(async (req, res) => {
  const job = await jobService.updateJob(req.params.id, req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: job,
  });
});

/**
 * Cancel job
 * POST /api/jobs/:id/cancel
 */
const cancelJob = asyncHandler(async (req, res) => {
  const result = await jobService.cancelJob(req.params.id, req.user.id, req.body.reason);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  createJob,
  getJob,
  getMyJobs,
  browseJobs,
  updateJob,
  cancelJob,
};
