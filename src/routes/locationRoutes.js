const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate, locationSchemas } = require('../middleware/validation');

/**
 * Location Routes
 */

// Update live location
router.post(
  '/update',
  authenticate,
  validate(locationSchemas.updateLocation),
  locationController.updateLocation
);

// Find nearby artisans
router.get(
  '/nearby',
  optionalAuth,
  validate(locationSchemas.nearbySearch),
  locationController.findNearby
);

// Calculate distance
router.post('/distance', optionalAuth, locationController.calculateDistance);

module.exports = router;
