const reviewService = require('../services/reviewService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Review Controller
 */

/**
 * Create review
 * POST /api/reviews
 */
const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: review,
  });
});

/**
 * Get user reviews
 * GET /api/reviews/user/:id
 */
const getUserReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.getUserReviews(req.params.id, req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Flag review
 * POST /api/reviews/:id/flag
 */
const flagReview = asyncHandler(async (req, res) => {
  const result = await reviewService.flagReview(req.params.id, req.user.id, req.body.reason);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  createReview,
  getUserReviews,
  flagReview,
};
