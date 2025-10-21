const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

/**
 * Notification Routes
 */

// Get notifications
router.get('/', authenticate, notificationController.getNotifications);

// Mark notification as read
router.patch('/:id/read', authenticate, notificationController.markAsRead);

// Register device token
router.post('/device-token', authenticate, notificationController.registerDeviceToken);

// Unregister device token
router.delete('/device-token/:token', authenticate, notificationController.unregisterDeviceToken);

module.exports = router;
