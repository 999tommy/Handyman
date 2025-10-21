const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Authentication Controller
 * 
 * Handles HTTP requests for authentication
 * Controllers are thin - they just handle req/res and delegate to services
 * This is different from Next.js where you might do everything in the API route
 */

/**
 * Register customer
 * POST /api/auth/register/customer
 */
const registerCustomer = asyncHandler(async (req, res) => {
  const result = await authService.registerCustomer(req.body);

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * Register artisan
 * POST /api/auth/register/artisan
 */
const registerArtisan = asyncHandler(async (req, res) => {
  const result = await authService.registerArtisan(req.body);

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * Login
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Send phone verification code
 * POST /api/auth/send-verification-code
 */
const sendVerificationCode = asyncHandler(async (req, res) => {
  const { phone_number } = req.body;
  const result = await authService.sendPhoneVerificationCode(phone_number);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Verify phone number
 * POST /api/auth/verify-phone
 */
const verifyPhone = asyncHandler(async (req, res) => {
  const { phone_number, verification_code } = req.body;
  const result = await authService.verifyPhone(req.user.id, phone_number, verification_code);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  const result = await authService.refreshAccessToken(refresh_token);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  registerCustomer,
  registerArtisan,
  login,
  sendVerificationCode,
  verifyPhone,
  refreshToken,
};
