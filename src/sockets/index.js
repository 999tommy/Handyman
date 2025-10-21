const socketAuthMiddleware = require('./socketAuth');
const registerChatHandlers = require('./chatSocket');
const registerLocationHandlers = require('./locationSocket');
const locationService = require('../services/locationService');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../utils/constants');

/**
 * Socket.io Setup and Event Registration
 * 
 * Central place to register all socket handlers
 */

function setupSocketHandlers(io) {
  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connections
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

    // Join user's personal room for direct messaging
    socket.join(`user:${socket.userId}`);

    // Emit user online status
    io.emit(SOCKET_EVENTS.USER_ONLINE, {
      user_id: socket.userId,
      is_online: true,
    });

    // Register handlers
    registerChatHandlers(io, socket);
    registerLocationHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);

      // Mark user as offline in location tracking
      await locationService.markUserOffline(socket.userId);

      // Emit user offline status
      io.emit(SOCKET_EVENTS.USER_OFFLINE, {
        user_id: socket.userId,
        is_online: false,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  logger.info('Socket handlers registered successfully');
}

module.exports = setupSocketHandlers;
