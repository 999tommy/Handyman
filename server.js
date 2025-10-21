const http = require('http');
const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/utils/logger');
const { initializeSocket } = require('./src/config/socket');
const { testConnection } = require('./src/config/supabase');
const setupSocketHandlers = require('./src/sockets');

/**
 * Server Entry Point
 * 
 * This is where everything comes together:
 * 1. Create HTTP server
 * 2. Initialize Socket.io
 * 3. Start listening
 * 
 * In Next.js, this is handled automatically with `next start`
 * In Express, we manage the server lifecycle ourselves
 */

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// Setup Socket.io handlers
setupSocketHandlers(io);

// Make io accessible to the app
app.set('socketio', io);

/**
 * Start server
 */
async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('Failed to connect to database. Please check your Supabase configuration.');
      process.exit(1);
    }

    // Start listening
    server.listen(config.port, () => {
      logger.info(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🔨 Handyman Marketplace API                         ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(38)} ║
║   Port: ${config.port.toString().padEnd(45)} ║
║   API URL: ${config.apiUrl.padEnd(42)} ║
║                                                        ║
║   Socket.io: ✅ Enabled                               ║
║   Database: ✅ Connected                              ║
║                                                        ║
║   Documentation: /api                                  ║
║   Health Check: /health                                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);

      logger.info(`Server is ready to accept connections`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');

    // Close Socket.io connections
    io.close(() => {
      logger.info('Socket.io connections closed');
      
      // Exit process
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();
