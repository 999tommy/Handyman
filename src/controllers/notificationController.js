const notificationService = require('../services/notificationService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Notification Controller
 */

/**
 * Get notifications
 * GET /api/notifications
 */
const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getUserNotifications(req.user.id, req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAsRead(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Register device token
 * POST /api/notifications/device-token
 */
const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  const result = await notificationService.registerDeviceToken(req.user.id, token, platform);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Unregister device token
 * DELETE /api/notifications/device-token/:token
 */
const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const result = await notificationService.unregisterDeviceToken(req.params.token);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  registerDeviceToken,
  unregisterDeviceToken,
};
