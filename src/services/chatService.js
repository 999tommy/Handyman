const { supabase, supabaseAdmin } = require('../config/supabase');
const { NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');
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
 * Create or get an existing conversation.
 * Supports both offer-accepted job chats and direct profile enquiries (without job).
 * Accepts either:
 *   - createConversation(jobId, customerId, artisanId)
 *   - createConversation({ customerId, artisanId, jobId })
 * @param {string|Object} jobIdOrOptions
 * @param {string} [customerId]
 * @param {string} [artisanId]
 * @returns {Promise<Object>}
 */
async function createConversation(jobIdOrOptions, customerId, artisanId) {
  try {
    let jId = jobIdOrOptions;
    let cId = customerId;
    let aId = artisanId;

    if (typeof jobIdOrOptions === 'object' && jobIdOrOptions !== null) {
      jId = jobIdOrOptions.jobId || jobIdOrOptions.job_id || null;
      cId = jobIdOrOptions.customerId || jobIdOrOptions.customer_id;
      aId = jobIdOrOptions.artisanId || jobIdOrOptions.artisan_id;
    }

    if (!cId || !aId) {
      throw new ValidationError('Customer ID and Artisan ID are required');
    }

    if (cId === aId) {
      throw new ValidationError('You cannot start a conversation with yourself');
    }

    // 1. Verify artisan exists and fetch their profile details
    const { data: artisan, error: artisanError } = await supabaseAdmin
      .from('artisans')
      .select(`
        id,
        profession,
        profiles!artisans_id_fkey(id, full_name, profile_picture_url)
      `)
      .eq('id', aId)
      .maybeSingle();

    if (artisanError || !artisan) {
      throw new NotFoundError('Artisan');
    }

    // 2. Ensure customer record exists in customers table (for foreign key constraint)
    const { data: customerRecord } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', cId)
      .maybeSingle();

    if (!customerRecord) {
      const { error: custCreateError } = await supabaseAdmin
        .from('customers')
        .insert({ id: cId });
      if (custCreateError) {
        logger.warn('Could not auto-create customer entry for chat:', custCreateError);
      }
    }

    // 3. Check if conversation already exists
    let query = supabaseAdmin
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
          profiles!customers_id_fkey(full_name, profile_picture_url)
        ),
        artisan:artisans!artisan_id(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
          profession
        )
      `)
      .eq('customer_id', cId)
      .eq('artisan_id', aId);

    if (jId) {
      query = query.eq('job_id', jId);
    } else {
      query = query.is('job_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    const participantInfo = {
      id: artisan.id,
      name: artisan.profiles?.full_name || 'Artisan',
      full_name: artisan.profiles?.full_name || 'Artisan',
      avatar_url: artisan.profiles?.profile_picture_url || null,
      profile_picture_url: artisan.profiles?.profile_picture_url || null,
      profession: artisan.profession || null,
    };

    if (existing) {
      return {
        ...existing,
        participant: participantInfo,
      };
    }

    // 4. Create new conversation
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        job_id: jId || null,
        customer_id: cId,
        artisan_id: aId,
      })
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
          profiles!customers_id_fkey(full_name, profile_picture_url)
        ),
        artisan:artisans!artisan_id(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
          profession
        )
      `)
      .single();

    if (error) {
      logger.error('Conversation creation error:', error);
      throw new Error('Failed to create conversation');
    }

    // 5. Send initial system message
    await createSystemMessage(
      conversation.id,
      'conversation_started',
      jId
        ? 'Conversation started. You can now chat with each other about the job.'
        : 'Direct enquiry started. You can now chat with the artisan.',
      jId ? { job_id: jId } : null
    );

    logger.info(`Conversation created: ${conversation.id} (job: ${jId || 'none'})`);

    return {
      ...conversation,
      participant: participantInfo,
    };
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
          profiles!customers_id_fkey(full_name, profile_picture_url)
        ),
        artisan:artisans!artisan_id(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
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

/**
 * Get a single conversation by ID
 * @param {string} conversationId 
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getConversationById(conversationId, userId) {
  try {
    const { data: conversation, error } = await supabaseAdmin
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
          profiles!customers_id_fkey(full_name, profile_picture_url)
        ),
        artisan:artisans!artisan_id(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
          profession
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      throw new NotFoundError('Conversation');
    }

    const isParticipant =
      conversation.customer_id === userId ||
      conversation.artisan_id === userId;

    if (!isParticipant) {
      throw new ForbiddenError('You are not a participant in this conversation');
    }

    const isCustomer = conversation.customer_id === userId;
    const partnerData = isCustomer ? conversation.artisan : conversation.customer;

    const participant = {
      id: partnerData?.id,
      name: partnerData?.profiles?.full_name || 'User',
      full_name: partnerData?.profiles?.full_name || 'User',
      avatar_url: partnerData?.profiles?.profile_picture_url || null,
      profile_picture_url: partnerData?.profiles?.profile_picture_url || null,
      profession: partnerData?.profession || null,
    };

    return {
      ...conversation,
      participant,
    };
  } catch (error) {
    logger.logError(error, { context: 'getConversationById' });
    throw error;
  }
}

module.exports = {
  createConversation,
  getConversationById,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  createSystemMessage,
  markMessagesAsRead,
  rescheduleJob,
  increaseBudget,
};
