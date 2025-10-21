const chatService = require('../services/chatService');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../utils/constants');

/**
 * Chat Socket Handlers
 * 
 * Real-time chat functionality using Socket.io
 */

function registerChatHandlers(io, socket) {
  /**
   * Join a conversation room
   */
  socket.on(SOCKET_EVENTS.CHAT_JOIN, async ({ conversation_id }) => {
    try {
      // Verify user is participant in conversation
      const { data: conversation } = await require('../config/supabase').supabase
        .from('conversations')
        .select('customer_id, artisan_id')
        .eq('id', conversation_id)
        .single();

      if (!conversation) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Conversation not found' });
        return;
      }

      const isParticipant = 
        conversation.customer_id === socket.userId || 
        conversation.artisan_id === socket.userId;

      if (!isParticipant) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not a participant' });
        return;
      }

      // Join room
      socket.join(`conversation:${conversation_id}`);
      logger.debug(`User ${socket.userId} joined conversation ${conversation_id}`);

      socket.emit(SOCKET_EVENTS.CHAT_JOIN, { 
        conversation_id, 
        status: 'joined' 
      });
    } catch (error) {
      logger.error('Chat join error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join conversation' });
    }
  });

  /**
   * Leave a conversation room
   */
  socket.on(SOCKET_EVENTS.CHAT_LEAVE, ({ conversation_id }) => {
    socket.leave(`conversation:${conversation_id}`);
    logger.debug(`User ${socket.userId} left conversation ${conversation_id}`);
  });

  /**
   * Send message (handled via REST API, but emit to room)
   */
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (data) => {
    try {
      const { conversation_id, content, message_type = 'text' } = data;

      // Send message via service (for persistence)
      const message = await chatService.sendMessage(
        conversation_id,
        socket.userId,
        { content, message_type }
      );

      // Message is already emitted by service, but we can emit acknowledgment
      socket.emit('message:sent', { message_id: message.id });
    } catch (error) {
      logger.error('Chat message error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
    }
  });

  /**
   * Typing indicator
   */
  socket.on(SOCKET_EVENTS.CHAT_TYPING, async ({ conversation_id, is_typing }) => {
    try {
      // Broadcast to other participants in the room
      socket.to(`conversation:${conversation_id}`).emit(SOCKET_EVENTS.CHAT_TYPING, {
        user_id: socket.userId,
        is_typing,
      });
    } catch (error) {
      logger.error('Typing indicator error:', error);
    }
  });

  /**
   * Mark messages as read
   */
  socket.on(SOCKET_EVENTS.CHAT_READ, async ({ conversation_id, message_ids }) => {
    try {
      await chatService.markMessagesAsRead(conversation_id, socket.userId, message_ids);

      // Notify other participant
      socket.to(`conversation:${conversation_id}`).emit(SOCKET_EVENTS.CHAT_READ, {
        user_id: socket.userId,
        message_ids,
      });
    } catch (error) {
      logger.error('Mark read error:', error);
    }
  });
}

module.exports = registerChatHandlers;
