const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { authenticate } = require('../middleware/auth');
const { requireArtisan, requireCustomer } = require('../middleware/roleCheck');
const { validate, offerSchemas } = require('../middleware/validation');
const { offerLimiter } = require('../middleware/rateLimiter');

/**
 * Offer Routes
 */

// Create offer (artisan only)
router.post(
  '/',
  authenticate,
  requireArtisan,
  offerLimiter,
  validate(offerSchemas.createOffer),
  offerController.createOffer
);

// Accept offer (customer only)
router.post(
  '/:id/accept',
  authenticate,
  requireCustomer,
  offerController.acceptOffer
);

// Update offer (artisan only)
router.patch(
  '/:id',
  authenticate,
  requireArtisan,
  validate(offerSchemas.updateOffer),
  offerController.updateOffer
);

// Withdraw offer (artisan only)
router.delete(
  '/:id',
  authenticate,
  requireArtisan,
  offerController.withdrawOffer
);

module.exports = router;
