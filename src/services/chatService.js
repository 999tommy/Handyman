const { supabase } = require('../config/supabase');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { MESSAGE_TYPES } = require('../utils/constants');
const { paginate, createPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const { emitToConversation, emitToUser } = require('../config/socket');

/**
 * Chat Service
 * 
 * Business logic for real-time chat between customers and artisans
 */

/**
 * Create a conversation (after offer acceptance)
 * @param {string} jobId 
 * @param {string} customerId 
 * @param {string} artisanId 
 * @returns {Promise<Object>}
 */
async function createConversation(jobId, customerId, artisanId) {
  try {
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', jobId)
      .eq('customer_id', customerId)
      .eq('artisan_id', artisanId)
      .single();

    if (existing) {
      return existing;
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        job_id: jobId,
        customer_id: customerId,
        artisan_id: artisanId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Conversation creation error:', error);
      throw new Error('Failed to create conversation');
    }

    // Send system message
    await createSystemMessage(
      conversation.id,
      'conversation_started',
      'Conversation started. You can now chat with each other about the job.',
      { job_id: jobId }
    );

    logger.info(`Conversation created: ${conversation.id}`);

    return conversation;
  } catch (error) {
    logger.logError(error, { context: 'createConversation' });
    throw error;
  }
}

/**
 * Get user's conversations
 * @param {string} userId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getUserConversations(userId, options = {}) {
  try {
    const { page = 1, limit = 20 } = options;
    const { offset, limit: validLimit } = paginate(page, limit);

    const { data: conversations, error, count } = await supabase
      .from('conversations')
      .select(`
        id,
        job_id,
        customer_id,
        artisan_id,
        created_at,
        updated_at,
        job:jobs(id, title, status),
        customer:customers!customer_id(
          id,
          profiles(full_name, profile_picture_url)
        ),
        artisan:artisans!artisan_id(
          id,
          profiles(full_name, profile_picture_url),
          profession
        ),
        last_message:messages(
          content,
          created_at,
          is_read,
          sender_id
        )
      `, { count: 'exact' })
      .or(`customer_id.eq.${userId},artisan_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .range(offset, offset + validLimit - 1);

    if (error) {
      throw new Error('Failed to fetch conversations');
    }

    // Get unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_read', false)
          .neq('sender_id', userId);

        // Determine the participant (the other person)
        const participant = conv.customer_id === userId ? conv.artisan : conv.customer;

        return {
          ...conv,
          participant,
          unread_count: unreadCount || 0,
          last_message: conv.last_message?.[0] || null,
        };
      })
    );

    return {
      conversations: conversationsWithUnread,
      pagination: createPaginationMeta(count, page, validLimit),
    };
  } catch (error) {
    logger.logError(error, { context: 'getUserConversations' });
    throw error;
  }
}

/**
 * Get conversation messages
 * @param {string} conversationId 
 * @param {string} userId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getConversationMessages(conversationId, userId, options = {}) {
  try {
    const { page = 1, limit = 50 } = options;
    const { offset, limit: validLimit } = paginate(page, limit);

    // Verify user is participant
    const { data: conversation } = await supabase
      .from('conversations')
      .select('customer_id, artisan_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    const isParticipant = 
      conversation.customer_id === userId || 
      conversation.artisan_id === userId;

    if (!isParticipant) {
      throw new ForbiddenError('You are not a participant in this conversation');
    }

    // Fetch messages
    const { data: messages, error, count } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(full_name, profile_picture_url)
      `, { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + validLimit - 1);

    if (error) {
      throw new Error('Failed to fetch messages');
    }

    return {
      messages: messages.reverse(), // Oldest first
      pagination: createPaginationMeta(count, page, validLimit),
    };
  } catch (error) {
    logger.logError(error, { context: 'getConversationMessages' });
    throw error;
  }
}

/**
 * Send a message
 * @param {string} conversationId 
 * @param {string} senderId 
 * @param {Object} messageData 
 * @returns {Promise<Object>}
 */
async function sendMessage(conversationId, senderId, messageData) {
  try {
    const { message_type = MESSAGE_TYPES.TEXT, content, image_url } = messageData;

    // Verify user is participant
    const { data: conversation } = await supabase
      .from('conversations')
      .select('customer_id, artisan_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    const isParticipant = 
      conversation.customer_id === senderId || 
      conversation.artisan_id === senderId;

    if (!isParticipant) {
      throw new ForbiddenError('You are not a participant in this conversation');
    }

    // Create message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_type,
        content,
        image_url,
      })
      .select(`
        *,
        sender:profiles!sender_id(full_name, profile_picture_url)
      `)
      .single();

    if (error) {
      logger.error('Message creation error:', error);
      throw new Error('Failed to send message');
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Emit to conversation room (Socket.io)
    try {
      emitToConversation(conversationId, 'chat:message', message);
    } catch (socketError) {
      logger.warn('Socket emit failed:', socketError.message);
    }

    // Get recipient ID
    const recipientId = conversation.customer_id === senderId 
      ? conversation.artisan_id 
      : conversation.customer_id;

    // Send push notification if recipient is offline
    const notificationService = require('./notificationService');
    await notificationService.sendNotification(
      recipientId,
      'new_message',
      'New Message',
      content,
      { conversation_id: conversationId }
    );

    logger.debug(`Message sent in conversation ${conversationId}`);

    return message;
  } catch (error) {
    logger.logError(error, { context: 'sendMessage' });
    throw error;
  }
}

/**
 * Create system message
 * @param {string} conversationId 
 * @param {string} eventType 
 * @param {string} content 
 * @param {Object} metadata 
 * @returns {Promise<Object>}
 */
async function createSystemMessage(conversationId, eventType, content, metadata = null) {
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: null,
        message_type: MESSAGE_TYPES.SYSTEM,
        content,
        system_event: eventType,
        system_metadata: metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create system message');
    }

    // Emit to conversation room
    try {
      emitToConversation(conversationId, 'chat:message', message);
    } catch (socketError) {
      logger.warn('Socket emit failed:', socketError.message);
    }

    return message;
  } catch (error) {
    logger.logError(error, { context: 'createSystemMessage' });
    throw error;
  }
}

/**
 * Mark messages as read
 * @param {string} conversationId 
 * @param {string} userId 
 * @param {Array} messageIds 
 * @returns {Promise<Object>}
 */
async function markMessagesAsRead(conversationId, userId, messageIds = null) {
  try {
    let query = supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    }

    const { error } = await query;

    if (error) {
      throw new Error('Failed to mark messages as read');
    }

    // Emit read receipt
    try {
      emitToConversation(conversationId, 'chat:read', { 
        user_id: userId, 
        message_ids: messageIds 
      });
    } catch (socketError) {
      logger.warn('Socket emit failed:', socketError.message);
    }

    return { message: 'Messages marked as read' };
  } catch (error) {
    logger.logError(error, { context: 'markMessagesAsRead' });
    throw error;
  }
}

/**
 * Reschedule job (in-chat action)
 * @param {string} conversationId 
 * @param {string} userId 
 * @param {Object} scheduleData 
 * @returns {Promise<Object>}
 */
async function rescheduleJob(conversationId, userId, scheduleData) {
  try {
    const { new_date, new_time } = scheduleData;

    // Get conversation and job
    const { data: conversation } = await supabase
      .from('conversations')
      .select('job_id, customer_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    // Only customer can reschedule
    if (conversation.customer_id !== userId) {
      throw new ForbiddenError('Only the customer can reschedule');
    }

    // Update job
    await supabase
      .from('jobs')
      .update({
        preferred_date: new_date,
        time_preference: new_time,
      })
      .eq('id', conversation.job_id);

    // Create system message
    const message = await createSystemMessage(
      conversationId,
      'job_rescheduled',
      `Job rescheduled to ${new_date}${new_time ? ` (${new_time})` : ''}`,
      { new_date, new_time }
    );

    logger.info(`Job rescheduled via chat: ${conversation.job_id}`);

    return { message: 'Job rescheduled', system_message_id: message.id };
  } catch (error) {
    logger.logError(error, { context: 'rescheduleJob' });
    throw error;
  }
}

/**
 * Increase job budget (in-chat action)
 * @param {string} conversationId 
 * @param {string} userId 
 * @param {number} newBudget 
 * @returns {Promise<Object>}
 */
async function increaseBudget(conversationId, userId, newBudget) {
  try {
    // Get conversation and job
    const { data: conversation } = await supabase
      .from('conversations')
      .select('job_id, customer_id, job:jobs(budget)')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    // Only customer can increase budget
    if (conversation.customer_id !== userId) {
      throw new ForbiddenError('Only the customer can modify budget');
    }

    // Update job
    await supabase
      .from('jobs')
      .update({ budget: newBudget })
      .eq('id', conversation.job_id);

    // Create system message
    const message = await createSystemMessage(
      conversationId,
      'budget_increased',
      `Budget increased to ₦${newBudget.toLocaleString()}`,
      { old_budget: conversation.job.budget, new_budget: newBudget }
    );

    logger.info(`Budget increased via chat for job: ${conversation.job_id}`);

    return { message: 'Budget updated', system_message_id: message.id };
  } catch (error) {
    logger.logError(error, { context: 'increaseBudget' });
    throw error;
  }
}

module.exports = {
  createConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  createSystemMessage,
  markMessagesAsRead,
  rescheduleJob,
  increaseBudget,
};
