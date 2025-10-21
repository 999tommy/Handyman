const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requireCustomerOrArtisan } = require('../middleware/roleCheck');

/**
 * User Routes
 */

// Get current user profile
router.get('/me', authenticate, userController.getCurrentUser);

// Update current user profile
router.patch('/me', authenticate, userController.updateCurrentUser);

module.exports = router;
