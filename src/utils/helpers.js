const crypto = require('crypto');

/**
 * Utility Helper Functions
 */

/**
 * Generate random verification code
 * @param {number} length - Length of code (default: 6)
 * @returns {string} Random numeric code
 */
function generateVerificationCode(length = 6) {
  // Hardcoded for development as requested
  return '666666';
}

/**
 * Generate unique reference code
 * @param {string} prefix - Prefix for reference (e.g., 'TXN', 'JOB')
 * @returns {string} Unique reference
 */
function generateReference(prefix = 'REF') {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${randomStr}`.toUpperCase();
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Format currency (Nigerian Naira)
 * @param {number} amount - Amount in kobo or naira
 * @param {boolean} inKobo - If true, amount is in kobo
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, inKobo = false) {
  const naira = inKobo ? amount / 100 : amount;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(naira);
}

/**
 * Calculate platform fee
 * @param {number} amount - Job amount
 * @param {number} feePercentage - Platform fee percentage
 * @returns {Object} { platformFee, artisanPayout }
 */
function calculatePlatformFee(amount, feePercentage) {
  const platformFee = Math.round(amount * (feePercentage / 100));
  const artisanPayout = amount - platformFee;
  
  return {
    platformFee,
    artisanPayout,
  };
}

/**
 * Paginate results
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} { offset, limit }
 */
function paginate(page = 1, limit = 20) {
  const validPage = Math.max(1, parseInt(page, 10));
  const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (validPage - 1) * validLimit;
  
  return { offset, limit: validLimit };
}

/**
 * Create pagination metadata
 * @param {number} total - Total items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
function createPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    pages: totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mask sensitive data (phone, email)
 * @param {string} value - Value to mask
 * @param {string} type - Type (phone, email)
 * @returns {string} Masked value
 */
function maskSensitiveData(value, type = 'phone') {
  if (!value) return '';
  
  if (type === 'email') {
    const [local, domain] = value.split('@');
    const maskedLocal = local.slice(0, 2) + '***' + local.slice(-1);
    return `${maskedLocal}@${domain}`;
  }
  
  if (type === 'phone') {
    return value.slice(0, 4) + '****' + value.slice(-3);
  }
  
  return value;
}

/**
 * Validate Nigerian phone number
 * @param {string} phone - Phone number
 * @returns {boolean}
 */
function isValidNigerianPhone(phone) {
  // Nigerian phone: +234XXXXXXXXXX or 0XXXXXXXXXXX
  const regex = /^(\+234|0)[789]\d{9}$/;
  return regex.test(phone);
}

/**
 * Format Nigerian phone to international
 * @param {string} phone - Phone number
 * @returns {string} International format
 */
function formatPhoneToInternational(phone) {
  if (phone.startsWith('+234')) return phone;
  if (phone.startsWith('0')) return '+234' + phone.slice(1);
  return '+234' + phone;
}

/**
 * Get time of day from hour
 * @param {number} hour - Hour (0-23)
 * @returns {string} morning, midday, afternoon, evening
 */
function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Check if date is in the past
 * @param {string|Date} date - Date to check
 * @returns {boolean}
 */
function isDateInPast(date) {
  const checkDate = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return checkDate < now;
}

module.exports = {
  generateVerificationCode,
  generateReference,
  calculateDistance,
  sanitizeInput,
  formatCurrency,
  calculatePlatformFee,
  paginate,
  createPaginationMeta,
  sleep,
  maskSensitiveData,
  isValidNigerianPhone,
  formatPhoneToInternational,
  getTimeOfDay,
  isDateInPast,
};
