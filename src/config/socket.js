const { Server } = require('socket.io');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * Socket.io Configuration
 * 
 * Initialize Socket.io server with authentication and room management
 * for real-time chat and geolocation features
 */

let io;

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 */
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  logger.info('Socket.io server initialized');

  // Middleware and event handlers are registered in socket handlers
  return io;
}

/**
 * Get Socket.io instance
 * @returns {Object} Socket.io server instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket() first.');
  }
  return io;
}

/**
 * Emit to specific user by their user ID
 * @param {string} userId - User ID to send event to
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
function emitToUser(userId, event, data) {
  const io = getIO();
  io.to(`user:${userId}`).emit(event, data);
  logger.debug(`Emitted ${event} to user ${userId}`);
}

/**
 * Emit to specific conversation room
 * @param {string} conversationId - Conversation ID
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
function emitToConversation(conversationId, event, data) {
  const io = getIO();
  io.to(`conversation:${conversationId}`).emit(event, data);
  logger.debug(`Emitted ${event} to conversation ${conversationId}`);
}

/**
 * Get all connected sockets for a user
 * @param {string} userId - User ID
 * @returns {Array} Array of socket IDs
 */
async function getUserSockets(userId) {
  const io = getIO();
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  return sockets.map(socket => socket.id);
}

/**
 * Check if user is online
 * @param {string} userId - User ID
 * @returns {boolean} True if user has active connections
 */
async function isUserOnline(userId) {
  const sockets = await getUserSockets(userId);
  return sockets.length > 0;
}

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToConversation,
  getUserSockets,
  isUserOnline,
};
