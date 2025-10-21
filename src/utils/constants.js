/**
 * Application Constants
 */

// User Roles
const USER_ROLES = {
  CUSTOMER: 'customer',
  ARTISAN: 'artisan',
  ADMIN: 'admin',
};

// Job Status
const JOB_STATUS = {
  DRAFT: 'draft',
  POSTED: 'posted',
  OFFERS_RECEIVED: 'offers_received',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
};

// Offer Status
const OFFER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  HELD: 'held',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

// Verification Status
const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

// Artisan Approval Status
const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Service Types
const SERVICE_TYPES = {
  ONSITE: 'onsite',
  ONLINE: 'online',
};

// Time Preferences
const TIME_PREFERENCES = {
  MORNING: 'morning',
  MIDDAY: 'midday',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  FLEXIBLE: 'flexible',
};

// Date Preferences
const DATE_PREFERENCES = {
  ON_DATE: 'on_date',
  BEFORE_DATE: 'before_date',
  FLEXIBLE: 'flexible',
};

// Message Types
const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  SYSTEM: 'system',
};

// Notification Types
const NOTIFICATION_TYPES = {
  NEW_JOB: 'new_job',
  OFFER_RECEIVED: 'offer_received',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_REJECTED: 'offer_rejected',
  JOB_ASSIGNED: 'job_assigned',
  JOB_STARTED: 'job_started',
  JOB_COMPLETED: 'job_completed',
  JOB_CANCELLED: 'job_cancelled',
  PAYMENT_RECEIVED: 'payment_received',
  NEW_MESSAGE: 'new_message',
  REVIEW_RECEIVED: 'review_received',
};

// Socket Events
const SOCKET_EVENTS = {
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  
  // Chat
  CHAT_JOIN: 'chat:join',
  CHAT_LEAVE: 'chat:leave',
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  
  // Location
  LOCATION_UPDATE: 'location:update',
  LOCATION_TRACK: 'location:track',
  LOCATION_STOP: 'location:stop',
  
  // User status
  USER_STATUS: 'user:status',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  
  // Notifications
  NOTIFICATION: 'notification',
  
  // Errors
  ERROR: 'error',
};

// Error Codes
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
};

// Days of Week
const DAYS_OF_WEEK = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

// Upload constraints
const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_PHOTOS_PER_JOB: 5,
  MAX_PORTFOLIO_IMAGES: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Geolocation
const GEO = {
  DEFAULT_RADIUS_KM: 25,
  MAX_RADIUS_KM: 100,
  MIN_RADIUS_KM: 1,
};

module.exports = {
  USER_ROLES,
  JOB_STATUS,
  OFFER_STATUS,
  PAYMENT_STATUS,
  VERIFICATION_STATUS,
  APPROVAL_STATUS,
  SERVICE_TYPES,
  TIME_PREFERENCES,
  DATE_PREFERENCES,
  MESSAGE_TYPES,
  NOTIFICATION_TYPES,
  SOCKET_EVENTS,
  ERROR_CODES,
  DAYS_OF_WEEK,
  UPLOAD_LIMITS,
  PAGINATION,
  GEO,
};
