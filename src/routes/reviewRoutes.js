const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');
const { validate, reviewSchemas } = require('../middleware/validation');

/**
 * Review Routes
 */

// Create review
router.post(
  '/',
  authenticate,
  validate(reviewSchemas.createReview),
  reviewController.createReview
);

// Get user reviews
router.get('/user/:id', reviewController.getUserReviews);

// Flag review
router.post('/:id/flag', authenticate, reviewController.flagReview);

module.exports = router;
