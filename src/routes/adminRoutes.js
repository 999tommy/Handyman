const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

/**
 * Admin Routes
 * All routes require admin role
 */

// Middleware: All routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Get pending artisans
router.get('/artisans/pending', adminController.getPendingArtisans);

// Approve artisan
router.post('/artisans/:id/approve', adminController.approveArtisan);

// Reject artisan
router.post('/artisans/:id/reject', adminController.rejectArtisan);

// Get platform statistics
router.get('/stats', adminController.getPlatformStats);

// Get flagged reviews
router.get('/reviews/flagged', adminController.getFlaggedReviews);

module.exports = router;
