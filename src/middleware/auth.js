const { supabase, supabaseAnon, createAuthenticatedClient } = require('../config/supabase');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../utils/constants');

/**
 * Authentication Middleware
 * 
 * Verifies JWT token from Supabase Auth and attaches user to request
 * This is the main difference from Next.js:
 * - In Next.js: You might use getServerSession() or middleware.ts
 * - In Express: We manually verify JWT on each protected route
 */

/**
 * Verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'No authentication token provided',
        },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      logger.warn(`Authentication failed: ${error?.message || 'Invalid token'}`);
      return res.status(401).json({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid or expired token',
        },
      });
    }

    // Fetch user profile with role using authenticated client context
    const userSupabase = createAuthenticatedClient(token);
    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Profile not found for authenticated user:', user.id);
      return res.status(401).json({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'User profile not found',
        },
      });
    }

    // Check if phone is verified (required for artisans, since customers bypass SMS OTP registration)
    if (profile.role === 'artisan' && !profile.phone_verified) {
      return res.status(403).json({
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Phone number not verified. Please verify your phone to continue.',
        },
      });
    }

    // Attach user data to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      profile,
    };

    // Attach token for creating authenticated Supabase client if needed
    req.token = token;

    logger.debug(`User authenticated: ${user.id} (${profile.role})`);
    next();
  } catch (error) {
    logger.logError(error, { context: 'authenticate middleware' });
    return res.status(500).json({
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Authentication error occurred',
      },
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work for both authenticated and guest users
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, proceed as guest
      req.user = null;
      return next();
    }

    // Try to authenticate
    await authenticate(req, res, next);
  } catch (error) {
    // If authentication fails, proceed as guest
    req.user = null;
    next();
  }
}

/**
 * Check if user's phone is verified
 */
function requirePhoneVerification(req, res, next) {
  if (!req.user || !req.user.profile.phone_verified) {
    return res.status(403).json({
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: 'Phone verification required',
      },
    });
  }
  next();
}

/**
 * Check if artisan is approved by admin
 */
async function requireArtisanApproval(req, res, next) {
  try {
    if (req.user.role !== 'artisan') {
      return next(); // Not an artisan, skip check
    }

    const { data: artisan, error } = await supabase
      .from('artisans')
      .select('approval_status')
      .eq('id', req.user.id)
      .single();

    if (error || !artisan) {
      return res.status(404).json({
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Artisan profile not found',
        },
      });
    }

    if (artisan.approval_status !== 'approved') {
      return res.status(403).json({
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Your artisan account is pending admin approval',
          details: {
            approval_status: artisan.approval_status,
          },
        },
      });
    }

    next();
  } catch (error) {
    logger.logError(error, { context: 'requireArtisanApproval middleware' });
    return res.status(500).json({
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error checking approval status',
      },
    });
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  requirePhoneVerification,
  requireArtisanApproval,
};
