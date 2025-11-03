const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { defaultLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const artisanRoutes = require('./routes/artisanRoutes');
const jobRoutes = require('./routes/jobRoutes');
const offerRoutes = require('./routes/offerRoutes');
const chatRoutes = require('./routes/chatRoutes');
const locationRoutes = require('./routes/locationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

/**
 * Express Application Setup
 * 
 * This is the main Express app configuration
 * In Next.js, this is handled automatically
 * In Express, we configure everything manually
 */

const app = express();

// =====================================================
// SECURITY MIDDLEWARE
// =====================================================

// Helmet - Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - Cross-Origin Resource Sharing
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// =====================================================
// LOGGING MIDDLEWARE
// =====================================================

// HTTP request logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// =====================================================
// BODY PARSING MIDDLEWARE
// =====================================================

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================================
// RATE LIMITING
// =====================================================

// Apply default rate limiting to all routes
app.use(defaultLimiter);

// =====================================================
// ROOT ROUTE
// =====================================================

app.get('/', (req, res) => {
  res.status(200).json({
    message: '🔨 Handyman Marketplace API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    documentation: '/api',
    health: '/health',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      artisans: '/api/artisans',
      jobs: '/api/jobs',
      offers: '/api/offers',
      chat: '/api/chat',
      location: '/api/location',
      payments: '/api/payments',
      reviews: '/api/reviews',
      notifications: '/api/notifications',
      admin: '/api/admin',
      upload: '/api/upload',
    },
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// =====================================================
// API ROUTES
// =====================================================

const API_PREFIX = '/api';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/artisans`, artisanRoutes);
app.use(`${API_PREFIX}/jobs`, jobRoutes);
app.use(`${API_PREFIX}/offers`, offerRoutes);
app.use(`${API_PREFIX}/chat`, chatRoutes);
app.use(`${API_PREFIX}/location`, locationRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/reviews`, reviewRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);

// API documentation route
app.get(`${API_PREFIX}`, (req, res) => {
  res.json({
    message: 'Handyman Marketplace API',
    version: '1.0.0',
    documentation: 'See README.md for API documentation',
    endpoints: {
      auth: `${API_PREFIX}/auth`,
      users: `${API_PREFIX}/users`,
      artisans: `${API_PREFIX}/artisans`,
      jobs: `${API_PREFIX}/jobs`,
      offers: `${API_PREFIX}/offers`,
      chat: `${API_PREFIX}/chat`,
      location: `${API_PREFIX}/location`,
      payments: `${API_PREFIX}/payments`,
      reviews: `${API_PREFIX}/reviews`,
      notifications: `${API_PREFIX}/notifications`,
      admin: `${API_PREFIX}/admin`,
      upload: `${API_PREFIX}/upload`,
    },
  });
});

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// =====================================================
// EXPORTS
// =====================================================

module.exports = app;
