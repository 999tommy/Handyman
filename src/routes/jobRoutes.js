const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const offerController = require('../controllers/offerController');
const { authenticate } = require('../middleware/auth');
const { requireCustomer, requireArtisan } = require('../middleware/roleCheck');
const { validate, jobSchemas } = require('../middleware/validation');
const { jobCreationLimiter, searchLimiter } = require('../middleware/rateLimiter');

/**
 * Job Routes
 */

// Create job (customer only)
router.post(
  '/',
  authenticate,
  requireCustomer,
  jobCreationLimiter,
  validate(jobSchemas.createJob),
  jobController.createJob
);

// Get customer's jobs
router.get(
  '/my-jobs',
  authenticate,
  requireCustomer,
  jobController.getMyJobs
);

// Browse jobs (artisan only)
router.get(
  '/browse',
  authenticate,
  requireArtisan,
  searchLimiter,
  validate(jobSchemas.browseJobs),
  jobController.browseJobs
);

// Get job offers
router.get(
  '/:jobId/offers',
  authenticate,
  offerController.getJobOffers
);

// Get job details
router.get('/:id', authenticate, jobController.getJob);

// Update job
router.patch(
  '/:id',
  authenticate,
  requireCustomer,
  validate(jobSchemas.updateJob),
  jobController.updateJob
);

// Cancel job
router.post(
  '/:id/cancel',
  authenticate,
  requireCustomer,
  jobController.cancelJob
);

module.exports = router;
