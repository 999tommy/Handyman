const { USER_ROLES, ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Role-Based Access Control Middleware
 * 
 * This is different from Next.js where you might check roles in getServerSideProps
 * In Express, we use middleware to protect routes based on user roles
 */

/**
 * Check if user has required role(s)
 * @param {string|Array} allowedRoles - Role or array of roles allowed to access
 * @returns {Function} Express middleware
 * 
 * Usage:
 *   router.get('/admin/dashboard', authenticate, requireRole('admin'), handler)
 *   router.post('/jobs', authenticate, requireRole(['customer']), handler)
 */
function requireRole(allowedRoles) {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication required',
        },
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Access denied for user ${req.user.id} (${req.user.role}) ` +
        `to route requiring roles: ${roles.join(', ')}`
      );

      return res.status(403).json({
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: `Access denied. Required role(s): ${roles.join(' or ')}`,
        },
      });
    }

    // User has required role
    next();
  };
}

/**
 * Ensure user is a customer
 */
const requireCustomer = requireRole(USER_ROLES.CUSTOMER);

/**
 * Ensure user is an artisan
 */
const requireArtisan = requireRole(USER_ROLES.ARTISAN);

/**
 * Ensure user is an admin
 */
const requireAdmin = requireRole(USER_ROLES.ADMIN);

/**
 * Allow customers or artisans (but not guests)
 */
const requireCustomerOrArtisan = requireRole([
  USER_ROLES.CUSTOMER,
  USER_ROLES.ARTISAN,
]);

/**
 * Check if user owns a resource
 * @param {Function} getResourceUserId - Function that extracts user ID from resource
 * @returns {Function} Express middleware
 * 
 * Example:
 *   const checkJobOwnership = requireOwnership(async (req) => {
 *     const job = await getJob(req.params.jobId);
 *     return job.customer_id;
 *   });
 */
function requireOwnership(getResourceUserId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required',
          },
        });
      }

      // Get the resource owner's user ID
      const resourceUserId = await getResourceUserId(req);

      // Admins bypass ownership check
      if (req.user.role === USER_ROLES.ADMIN) {
        return next();
      }

      // Check ownership
      if (req.user.id !== resourceUserId) {
        logger.warn(
          `Ownership check failed: User ${req.user.id} tried to access ` +
          `resource owned by ${resourceUserId}`
        );

        return res.status(403).json({
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: 'You do not have permission to access this resource',
          },
        });
      }

      next();
    } catch (error) {
      logger.logError(error, { context: 'requireOwnership middleware' });
      return res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'Error checking resource ownership',
        },
      });
    }
  };
}

module.exports = {
  requireRole,
  requireCustomer,
  requireArtisan,
  requireAdmin,
  requireCustomerOrArtisan,
  requireOwnership,
};
