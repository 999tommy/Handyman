const offerService = require('../services/offerService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Offer Controller
 */

/**
 * Create offer
 * POST /api/offers
 */
const createOffer = asyncHandler(async (req, res) => {
  const offer = await offerService.createOffer(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: offer,
  });
});

/**
 * Get job offers
 * GET /api/jobs/:jobId/offers
 */
const getJobOffers = asyncHandler(async (req, res) => {
  const offers = await offerService.getJobOffers(req.params.jobId, req.user.id);

  res.status(200).json({
    success: true,
    data: offers,
  });
});

/**
 * Accept offer
 * POST /api/offers/:id/accept
 */
const acceptOffer = asyncHandler(async (req, res) => {
  const result = await offerService.acceptOffer(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Update offer
 * PATCH /api/offers/:id
 */
const updateOffer = asyncHandler(async (req, res) => {
  const offer = await offerService.updateOffer(req.params.id, req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: offer,
  });
});

/**
 * Withdraw offer
 * DELETE /api/offers/:id
 */
const withdrawOffer = asyncHandler(async (req, res) => {
  const result = await offerService.withdrawOffer(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  createOffer,
  getJobOffers,
  acceptOffer,
  updateOffer,
  withdrawOffer,
};
