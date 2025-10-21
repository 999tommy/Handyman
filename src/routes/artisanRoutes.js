const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const reviewController = require('../controllers/reviewController');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { requireArtisan } = require('../middleware/roleCheck');
const { searchLimiter } = require('../middleware/rateLimiter');

/**
 * Artisan Routes
 */

// Search artisans (public with optional auth)
router.get('/search', searchLimiter, optionalAuth, userController.searchArtisans);

// Get artisan profile (public)
router.get('/:id', optionalAuth, userController.getArtisan);

// Get artisan reviews (public)
router.get('/:id/reviews', reviewController.getUserReviews);

// Update artisan profile (artisan only)
router.patch('/me', authenticate, requireArtisan, userController.updateArtisan);

module.exports = router;
