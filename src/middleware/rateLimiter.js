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
 * Limiter for job creation
 */
const jobCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 jobs per hour
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Job posting limit reached, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.id || req.ip;
  },
});

/**
 * Limiter for offer submission
 */
const offerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 offers per hour
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Offer submission limit reached, please try again later',
    },
  },
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Limiter for SMS verification
 */
const smsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 SMS per hour
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'SMS limit reached, please try again in an hour',
    },
  },
  keyGenerator: (req) => {
    // Rate limit by phone number or IP
    return req.body?.phone_number || req.ip;
  },
});

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
