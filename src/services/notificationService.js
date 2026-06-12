const { supabase } = require('../config/supabase');
const { NOTIFICATION_TYPES, GEO } = require('../utils/constants');
const logger = require('../utils/logger');
const { emitToUser } = require('../config/socket');
const axios = require('axios');
const config = require('../config/env');

/**
 * Notification Service
 * 
 * Handles in-app notifications and push notifications (FCM)
 */

/**
 * Send notification to user
 * @param {string} userId 
 * @param {string} type 
 * @param {string} title 
 * @param {string} body 
 * @param {Object} metadata 
 * @returns {Promise<Object>}
 */
async function sendNotification(userId, type, title, body, metadata = null) {
  try {
    // Create in-app notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        job_id: metadata?.job_id || null,
        offer_id: metadata?.offer_id || null,
        conversation_id: metadata?.conversation_id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Notification creation error:', error);
      throw new Error('Failed to create notification');
    }

    // Emit real-time notification via Socket.io
    try {
      emitToUser(userId, 'notification', notification);
    } catch (socketError) {
      logger.warn('Socket emit failed:', socketError.message);
    }

    // Send push notification
    await sendPushNotification(userId, title, body, metadata);

    logger.debug(`Notification sent to user ${userId}`);

    return notification;
  } catch (error) {
    logger.logError(error, { context: 'sendNotification' });
    throw error;
  }
}

/**
 * Send push notification via FCM
 * @param {string} userId 
 * @param {string} title 
 * @param {string} body 
 * @param {Object} data 
 */
async function sendPushNotification(userId, title, body, data = null) {
  try {
    if (!config.firebase.serverKey) {
      logger.warn('Firebase server key not configured');
      return;
    }

    // Get user's device tokens
    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !tokens || tokens.length === 0) {
      logger.debug(`No device tokens found for user ${userId}`);
      return;
    }

    // Send to each device
    const pushPromises = tokens.map(async ({ token, platform }) => {
      try {
        const response = await axios.post(
          'https://fcm.googleapis.com/fcm/send',
          {
            to: token,
            notification: {
              title,
              body,
              sound: 'default',
            },
            data: data || {},
            priority: 'high',
          },
          {
            headers: {
              'Authorization': `key=${config.firebase.serverKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        logger.debug(`Push notification sent to ${platform} device`);
        return response.data;
      } catch (error) {
        // If token is invalid, mark as inactive
        if (error.response?.status === 404) {
          await supabase
            .from('device_tokens')
            .update({ is_active: false })
            .eq('token', token);
        }
        logger.error(`Failed to send push to token: ${error.message}`);
      }
    });

    await Promise.all(pushPromises);
  } catch (error) {
    logger.logError(error, { context: 'sendPushNotification' });
  }
}

/**
 * Notify nearby artisans about new job
 * @param {Object} job 
 */
async function notifyNearbyArtisans(job) {
  try {
    // Get artisans in the same category within radius
    const { data: artisans, error } = await supabase
      .from('artisan_locations')
      .select(`
        artisan_id,
        artisan:artisans!inner(
          id,
          category_id,
          approval_status
        )
      `)
      .eq('artisan.category_id', job.category_id)
      .eq('artisan.approval_status', 'approved');

    if (error || !artisans) {
      logger.error('Failed to fetch artisans for notification');
      return;
    }

    // Send notification to each artisan
    const notificationPromises = artisans.map(artisan =>
      sendNotification(
        artisan.artisan_id,
        NOTIFICATION_TYPES.NEW_JOB,
        'New Job Available',
        `New ${job.title || 'New'} job posted in your area`,
        { job_id: job.id }
      )
    );

    await Promise.all(notificationPromises);

    logger.info(`Notified ${artisans.length} artisans about job ${job.id}`);
  } catch (error) {
    logger.logError(error, { context: 'notifyNearbyArtisans' });
  }
}

/**
 * Get user notifications
 * @param {string} userId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getUserNotifications(userId, options = {}) {
  try {
    const { page = 1, limit = 20, unread_only = false } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unread_only) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch notifications');
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return {
      notifications,
      unread_count: unreadCount || 0,
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'getUserNotifications' });
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId 
 * @param {string} userId 
 */
async function markAsRead(notificationId, userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to mark notification as read');
    }

    return { message: 'Notification marked as read' };
  } catch (error) {
    logger.logError(error, { context: 'markAsRead' });
    throw error;
  }
}

/**
 * Register device token
 * @param {string} userId 
 * @param {string} token 
 * @param {string} platform 
 */
async function registerDeviceToken(userId, token, platform) {
  try {
    const { error } = await supabase
      .from('device_tokens')
      .upsert({
        user_id: userId,
        token,
        platform,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,token',
      });

    if (error) {
      throw new Error('Failed to register device token');
    }

    logger.info(`Device token registered for user ${userId}`);

    return { message: 'Device token registered' };
  } catch (error) {
    logger.logError(error, { context: 'registerDeviceToken' });
    throw error;
  }
}

/**
 * Unregister device token
 * @param {string} token 
 */
async function unregisterDeviceToken(token) {
  try {
    const { error } = await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('token', token);

    if (error) {
      throw new Error('Failed to unregister device token');
    }

    return { message: 'Device token unregistered' };
  } catch (error) {
    logger.logError(error, { context: 'unregisterDeviceToken' });
    throw error;
  }
}

module.exports = {
  sendNotification,
  sendPushNotification,
  notifyNearbyArtisans,
  getUserNotifications,
  markAsRead,
  registerDeviceToken,
  unregisterDeviceToken,
};
