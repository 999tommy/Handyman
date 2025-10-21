const locationService = require('../services/locationService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Location Controller
 */

/**
 * Update live location
 * POST /api/location/update
 */
const updateLocation = asyncHandler(async (req, res) => {
  const result = await locationService.updateLiveLocation(req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Find nearby artisans
 * GET /api/location/nearby
 */
const findNearby = asyncHandler(async (req, res) => {
  const { lat, lng, ...filters } = req.query;
  
  const artisans = await locationService.findNearbyArtisans(
    parseFloat(lat),
    parseFloat(lng),
    filters
  );

  res.status(200).json({
    success: true,
    data: artisans,
  });
});

/**
 * Calculate distance
 * POST /api/location/distance
 */
const calculateDistance = asyncHandler(async (req, res) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.body;
  
  const result = await locationService.calculateDistanceBetweenPoints(
    { lat: from_lat, lng: from_lng },
    { lat: to_lat, lng: to_lng }
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  updateLocation,
  findNearby,
  calculateDistance,
};
