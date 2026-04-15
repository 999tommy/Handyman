const Joi = require('joi');
const { ERROR_CODES, JOB_STATUS, OFFER_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Request Validation Middleware using Joi
 * 
 * In Next.js, you might validate in API route handlers
 * In Express, we use middleware to validate before reaching controllers
 */

/**
 * Validate request data against Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 * 
 * Usage:
 *   router.post('/jobs', validate(jobSchema), createJob)
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      {
        abortEarly: false, // Return all errors, not just first
        stripUnknown: true, // Remove unknown fields
      }
    );

    if (error) {
      const errors = error.details.map(detail => {
        const rawPath = detail.path || [];
        const pathWithoutSource = ['body', 'query', 'params'].includes(rawPath[0])
          ? rawPath.slice(1)
          : rawPath;
        const field = pathWithoutSource.join('.') || rawPath.join('.') || 'unknown';

        // Joi wraps field names in quotes - remove them for cleaner messages
        const message = detail.message ? detail.message.replace(/"/g, '') : 'Invalid value';

        return {
          field,
          message,
        };
      });

      logger.debug('Validation error:', errors);

      return res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid input data',
          details: errors,
        },
      });
    }

    // Replace request data with validated data
    req.body = value.body || req.body;
    req.query = value.query || req.query;
    req.params = value.params || req.params;

    next();
  };
}

/**
 * Common validation schemas
 */

// UUID validation
const uuidSchema = Joi.string().uuid();

// Pagination
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Coordinates
const coordinatesSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

// Phone number (Nigerian format)
const phoneSchema = Joi.string().pattern(/^(\+234|0)[789]\d{9}$/);

// Email
const emailSchema = Joi.string().email();

// Password (min 8 chars, at least one letter and one number)
const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/);

/**
 * Authentication validation schemas
 */
const authSchemas = {
  registerCustomer: Joi.object({
    body: Joi.object({
      first_name: Joi.string().min(2).max(100).required(),
      last_name: Joi.string().min(2).max(100).required(),
      email: emailSchema.required(),
      password: passwordSchema.required(),
      phone_number: phoneSchema.required(),
      address: Joi.string().min(5).max(500).required(),
      interested_services: Joi.array().items(Joi.string()).min(1).required(),
    }),
  }),

  registerArtisan: Joi.object({
    body: Joi.object({
      // Basic Info (Required)
      category_id: uuidSchema.optional(), // What service they offer
      category_name: Joi.string().min(2).max(255).optional(), // Alternative to UUID
      full_name: Joi.string().min(2).max(255).required(),
      email: emailSchema.required(),
      password: passwordSchema.required(),
      phone_number: phoneSchema.required(), // SMS verification happens separately
      
      // Professional Info (Required)
      profession: Joi.string().min(2).max(100).required(),
      tagline: Joi.string().min(10).max(255).required(), // Short tagline
      years_experience: Joi.number().integer().min(0).max(50).required(),
      description: Joi.string().min(50).max(2000).required(), // Longer "describe yourself"
      skills: Joi.array().items(Joi.string()).min(1).required(), // Array of skills
      
      // Media (Required)
      profile_picture_url: Joi.string().uri().required(),
      government_id_url: Joi.string().uri().required(),
      portfolio_images: Joi.array().items(Joi.string().uri()).min(1).required(),
      
      // Pricing (Required)
      base_rate: Joi.number().min(100).required(), // How much they charge
      
      // Location (Required)
      workstation_address: Joi.string().min(10).required(), // Plain text address
      city: Joi.string().required(),
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      
      // Availability (Required)
      availability: Joi.array().items(
        Joi.object({
          day_of_week: Joi.number().integer().min(0).max(6).required(),
          start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
          end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        })
      ).min(1).required(),
      
      // Bank Details (Required)
      bank_name: Joi.string().required(),
      account_number: Joi.string().pattern(/^\d{10}$/).required(),
      account_name: Joi.string().required(),
    }).xor('category_id', 'category_name'),
  }),

  login: Joi.object({
    body: Joi.object({
      email: emailSchema.required(),
      password: Joi.string().required(),
    }),
  }),

  verifyPhone: Joi.object({
    body: Joi.object({
      phone_number: phoneSchema.required(),
      code: Joi.string().length(6).pattern(/^\d+$/).required(),
    }),
  }),

  sendVerificationCode: Joi.object({
    body: Joi.object({
      phone_number: phoneSchema.required(),
    }),
  }),
};

/**
 * Job validation schemas
 */
const jobSchemas = {
  createJob: Joi.object({
    body: Joi.object({
      category_id: uuidSchema.required(),
      title: Joi.string().min(5).max(255).required(),
      description: Joi.string().min(20).max(2000).required(),
      budget: Joi.number().min(1000).required(),
      date_preference: Joi.string().valid('on_date', 'before_date', 'flexible').required(),
      preferred_date: Joi.date().iso().min('now').optional(),
      deadline_date: Joi.date().iso().min('now').optional(),
      time_preference: Joi.string().valid('morning', 'midday', 'afternoon', 'evening', 'flexible').optional(),
      needs_specific_time: Joi.boolean().default(false),
      service_type: Joi.string().valid('onsite', 'online').required(),
      street: Joi.string().when('service_type', {
        is: 'onsite',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      city: Joi.string().when('service_type', {
        is: 'onsite',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      latitude: Joi.number().min(-90).max(90).when('service_type', {
        is: 'onsite',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      longitude: Joi.number().min(-180).max(180).when('service_type', {
        is: 'onsite',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      photos: Joi.array().items(Joi.string().uri()).max(5).optional(),
    }),
  }),

  updateJob: Joi.object({
    body: Joi.object({
      title: Joi.string().min(5).max(255).optional(),
      description: Joi.string().min(20).max(2000).optional(),
      budget: Joi.number().min(1000).optional(),
      preferred_date: Joi.date().iso().min('now').optional(),
      time_preference: Joi.string().valid('morning', 'midday', 'afternoon', 'evening', 'flexible').optional(),
    }),
  }),

  browseJobs: Joi.object({
    query: Joi.object({
      category: uuidSchema.optional(),
      city: Joi.string().optional(),
      max_distance: Joi.number().min(1).max(100).optional(),
      min_budget: Joi.number().optional(),
      max_budget: Joi.number().optional(),
      date_from: Joi.date().iso().optional(),
      date_to: Joi.date().iso().optional(),
      sort: Joi.string().valid('date', 'budget', 'distance').default('date'),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
    }),
  }),
};

/**
 * Offer validation schemas
 */
const offerSchemas = {
  createOffer: Joi.object({
    body: Joi.object({
      job_id: uuidSchema.required(),
      proposed_price: Joi.number().min(1000).required(),
      cover_letter: Joi.string().min(50).max(1000).required(),
      estimated_duration: Joi.string().max(50).optional(),
    }),
  }),

  updateOffer: Joi.object({
    body: Joi.object({
      proposed_price: Joi.number().min(1000).optional(),
      cover_letter: Joi.string().min(50).max(1000).optional(),
      estimated_duration: Joi.string().max(50).optional(),
    }),
  }),
};

/**
 * Location validation schemas
 */
const locationSchemas = {
  updateLocation: Joi.object({
    body: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      accuracy: Joi.number().min(0).optional(),
    }),
  }),

  nearbySearch: Joi.object({
    query: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      radius: Joi.number().min(1).max(100).default(25),
      category: uuidSchema.optional(),
    }),
  }),
};

/**
 * Chat validation schemas
 */
const chatSchemas = {
  sendMessage: Joi.object({
    body: Joi.object({
      message_type: Joi.string().valid('text', 'image').default('text'),
      content: Joi.string().max(5000).required(),
      image_url: Joi.string().uri().when('message_type', {
        is: 'image',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }),
  }),
};

/**
 * Review validation schemas
 */
const reviewSchemas = {
  createReview: Joi.object({
    body: Joi.object({
      job_id: uuidSchema.required(),
      reviewee_id: uuidSchema.required(),
      rating: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string().max(1000).optional(),
    }),
  }),
};

/**
 * Admin validation schemas
 */
const adminSchemas = {
  updateJobStatus: Joi.object({
    body: Joi.object({
      status: Joi.string().valid(...Object.values(JOB_STATUS)).required(),
      reason: Joi.string().max(500).allow('', null),
    }),
  }),
  updateOfferStatus: Joi.object({
    body: Joi.object({
      status: Joi.string().valid(...Object.values(OFFER_STATUS)).required(),
      reason: Joi.string().max(500).allow('', null),
    }),
  }),
  releasePayment: Joi.object({
    body: Joi.object({
      platform_fee: Joi.number().precision(2).min(0).optional(),
      artisan_payout: Joi.number().precision(2).min(0).optional(),
      reason: Joi.string().max(500).allow('', null),
    }),
  }),
  refundPayment: Joi.object({
    body: Joi.object({
      reason: Joi.string().max(500).allow('', null),
    }),
  }),
};

module.exports = {
  validate,
  authSchemas,
  jobSchemas,
  offerSchemas,
  locationSchemas,
  chatSchemas,
  reviewSchemas,
  adminSchemas,
};
