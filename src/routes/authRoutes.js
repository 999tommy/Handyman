const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, authSchemas } = require('../middleware/validation');
const { authLimiter, smsLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

/**
 * Authentication Routes
 * 
 * In Express, routes are explicitly defined (unlike Next.js file-based routing)
 * This gives you more control but requires more boilerplate
 */

// Register customer
router.post(
  '/register/customer',
  authLimiter,
  validate(authSchemas.registerCustomer),
  authController.registerCustomer
);

// Register artisan
router.post(
  '/register/artisan',
  authLimiter,
  validate(authSchemas.registerArtisan),
  authController.registerArtisan
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(authSchemas.login),
  authController.login
);

// Send verification code
router.post(
  '/send-verification-code',
  smsLimiter,
  validate(authSchemas.sendVerificationCode),
  authController.sendVerificationCode
);

// Verify phone
router.post(
  '/verify-phone',
  validate(authSchemas.verifyPhone),
  authController.verifyPhone
);

// Refresh token
router.post('/refresh', authController.refreshToken);

module.exports = router;
