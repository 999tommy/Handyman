const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { ERROR_CODES } = require('../utils/constants');

/**
 * Rate Limiting Middleware
 * 
 * Prevents abuse by limiting request frequency
 * Different limits for different endpoint types
 */

/**
 * Default rate limiter
 */
const defaultLimiter = rateLimit({
  windowMs: config.rateLimit?.windowMs || 60000, // Default: 1 minute
  max: config.rateLimit?.maxRequests || 100, // Default: 100 requests
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin users in development
    return config.nodeEnv === 'development' && req.user?.role === 'admin';
  },
});

/**
 * Strict limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many authentication attempts, please try again after 15 minutes',
    },
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Moderate limiter for search/browse endpoints
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many search requests, please slow down',
    },
  },
});

/**
 * Pass-through middleware for flows that should not block test/live demos.
 */
const noLimiter = (req, res, next) => next();

/**
 * No limiter for job creation.
 */
const jobCreationLimiter = noLimiter;

/**
 * No limiter for offer submission.
 */
const offerLimiter = noLimiter;

/**
 * No limiter for SMS verification.
 */
const smsLimiter = noLimiter;

/**
 * Limiter for file uploads
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads per 15 minutes
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Upload limit reached, please try again later',
    },
  },
});

module.exports = {
  defaultLimiter,
  authLimiter,
  searchLimiter,
  jobCreationLimiter,
  offerLimiter,
  smsLimiter,
  uploadLimiter,
};
