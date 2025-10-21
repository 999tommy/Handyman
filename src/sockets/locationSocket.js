const locationService = require('../services/locationService');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../utils/constants');

/**
 * Location Socket Handlers
 * 
 * Real-time location tracking
 */

function registerLocationHandlers(io, socket) {
  /**
   * Update user's live location
   */
  socket.on(SOCKET_EVENTS.LOCATION_UPDATE, async (data) => {
    try {
      const { latitude, longitude, accuracy } = data;

      // Update location in database
      await locationService.updateLiveLocation(socket.userId, {
        latitude,
        longitude,
        accuracy,
      });

      logger.debug(`Location updated for user ${socket.userId}`);

      // Broadcast to users tracking this user (if any)
      io.to(`tracking:${socket.userId}`).emit(SOCKET_EVENTS.LOCATION_UPDATE, {
        user_id: socket.userId,
        latitude,
        longitude,
        accuracy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Location update error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update location' });
    }
  });

  /**
   * Start tracking a user's location
   * (e.g., customer tracking artisan during active job)
   */
  socket.on(SOCKET_EVENTS.LOCATION_TRACK, async ({ user_id }) => {
    try {
      // TODO: Verify user has permission to track (e.g., active job together)
      
      // Join tracking room
      socket.join(`tracking:${user_id}`);
      logger.debug(`User ${socket.userId} tracking ${user_id}`);

      // Get current location
      const location = await locationService.getUserLocation(user_id);

      if (location) {
        socket.emit(SOCKET_EVENTS.LOCATION_UPDATE, {
          user_id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.last_updated,
        });
      }
    } catch (error) {
      logger.error('Location track error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to track location' });
    }
  });

  /**
   * Stop tracking a user's location
   */
  socket.on(SOCKET_EVENTS.LOCATION_STOP, ({ user_id }) => {
    socket.leave(`tracking:${user_id}`);
    logger.debug(`User ${socket.userId} stopped tracking ${user_id}`);
  });
}

module.exports = registerLocationHandlers;
