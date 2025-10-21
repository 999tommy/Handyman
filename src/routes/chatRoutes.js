const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const { validate, chatSchemas } = require('../middleware/validation');

/**
 * Chat Routes
 */

// Get conversations
router.get('/conversations', authenticate, chatController.getConversations);

// Get conversation messages
router.get('/conversations/:id/messages', authenticate, chatController.getMessages);

// Send message
router.post(
  '/conversations/:id/messages',
  authenticate,
  validate(chatSchemas.sendMessage),
  chatController.sendMessage
);

// Mark messages as read
router.post('/conversations/:id/read', authenticate, chatController.markAsRead);

// Reschedule job
router.post('/conversations/:id/reschedule', authenticate, chatController.rescheduleJob);

// Increase budget
router.post('/conversations/:id/increase-price', authenticate, chatController.increaseBudget);

module.exports = router;
