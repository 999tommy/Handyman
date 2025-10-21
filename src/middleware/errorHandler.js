const logger = require('../utils/logger');
const { ERROR_CODES } = require('../utils/constants');

/**
 * Global Error Handler Middleware
 * 
 * In Next.js, errors are handled per API route
 * In Express, we use a centralized error handler
 * This MUST be the last middleware in the chain
 */

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND);
  }
}

/**
 * Validation Error (400)
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

/**
 * Unauthorized Error (401)
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, ERROR_CODES.UNAUTHORIZED);
  }
}

/**
 * Forbidden Error (403)
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, ERROR_CODES.FORBIDDEN);
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, ERROR_CODES.CONFLICT);
  }
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Default to 500 internal server error
  let statusCode = err.statusCode || 500;
  let code = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Log error
  if (statusCode >= 500) {
    logger.logError(err, {
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
    });
  } else {
    logger.warn(`${statusCode} Error: ${message}`, {
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Handle specific error types
  
  // Supabase errors
  if (err.code && err.code.startsWith('PGRST')) {
    statusCode = 400;
    code = ERROR_CODES.BAD_REQUEST;
    message = 'Database operation failed';
    details = process.env.NODE_ENV === 'development' ? err.message : null;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = ERROR_CODES.UNAUTHORIZED;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = ERROR_CODES.UNAUTHORIZED;
    message = 'Token expired';
  }

  // Multer (file upload) errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
    } else {
      message = 'File upload error';
    }
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Internal server error';
    details = null;
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
}

/**
 * 404 handler for undefined routes
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * Usage:
 *   router.get('/jobs', asyncHandler(async (req, res) => {
 *     const jobs = await getJobs();
 *     res.json(jobs);
 *   }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
};
