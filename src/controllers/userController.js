const userService = require('../services/userService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * User Controller
 */

/**
 * Get current user profile
 * GET /api/users/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const profile = await userService.getUserProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Update current user profile
 * PATCH /api/users/me
 */
const updateCurrentUser = asyncHandler(async (req, res) => {
  const profile = await userService.updateUserProfile(req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: {
      profile,
    },
  });
});

/**
 * Get artisan profile (public)
 * GET /api/artisans/:id
 */
const getArtisan = asyncHandler(async (req, res) => {
  const artisan = await userService.getArtisanProfile(req.params.id);

  res.status(200).json({
    success: true,
    data: artisan,
  });
});

/**
 * Search artisans
 * GET /api/artisans/search
 */
const searchArtisans = asyncHandler(async (req, res) => {
  const result = await userService.searchArtisans(req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Update artisan profile
 * PATCH /api/artisans/me
 */
const updateArtisan = asyncHandler(async (req, res) => {
  const artisan = await userService.updateArtisanProfile(req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: artisan,
  });
});

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getArtisan,
  searchArtisans,
  updateArtisan,
};
