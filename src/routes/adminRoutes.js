const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');
const { validate, adminSchemas } = require('../middleware/validation');

/**
 * Admin Routes
 * All routes require admin role
 */

// Middleware: All routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Artisan approvals
router.get('/artisans/pending', adminController.getPendingArtisans);
router.post('/artisans/:id/approve', adminController.approveArtisan);
router.post('/artisans/:id/reject', adminController.rejectArtisan);

// Users
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);

// Jobs
router.get('/jobs', adminController.listJobs);
router.patch(
  '/jobs/:id/status',
  validate(adminSchemas.updateJobStatus),
  adminController.updateJobStatus
);

// Offers
router.get('/offers', adminController.listOffers);
router.patch(
  '/offers/:id/status',
  validate(adminSchemas.updateOfferStatus),
  adminController.updateOfferStatus
);

// Payments
router.get('/payments', adminController.listPayments);
router.get('/payments/metrics', adminController.getPaymentMetrics);
router.post(
  '/payments/:id/release',
  validate(adminSchemas.releasePayment),
  adminController.releasePayment
);
router.post(
  '/payments/:id/refund',
  validate(adminSchemas.refundPayment),
  adminController.refundPayment
);

// Stats & reviews
router.get('/stats', adminController.getPlatformStats);
router.get('/reviews/flagged', adminController.getFlaggedReviews);

module.exports = router;
