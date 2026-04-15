const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Audit Service
 *
 * Writes admin actions and payment events for traceability.
 */

/**
 * Log an admin action
 * @param {Object} params
 * @param {string} params.adminId
 * @param {string} params.action
 * @param {string} params.targetType
 * @param {string} [params.targetId]
 * @param {Object} [params.metadata]
 * @returns {Promise<void>}
 */
async function logAdminAction({ adminId, action, targetType, targetId, metadata }) {
  try {
    await supabaseAdmin
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: targetId || null,
        metadata: metadata || null,
      });
  } catch (error) {
    logger.logError(error, { context: 'logAdminAction', action, targetType, targetId });
  }
}

/**
 * Record Paystack webhook event
 * @param {Object} params
 * @param {string} params.paystackEventId
 * @param {string} params.eventType
 * @param {string} [params.eventStatus]
 * @param {Object} params.payload
 * @param {string} [params.paymentId]
 * @returns {Promise<Object|null>}
 */
async function recordPaymentEvent({ paystackEventId, eventType, eventStatus, payload, paymentId }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('payment_events')
      .insert({
        payment_id: paymentId || null,
        paystack_event_id: paystackEventId,
        event_type: eventType,
        event_status: eventStatus || null,
        raw_payload: payload,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Duplicate (already processed)
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.logError(error, { context: 'recordPaymentEvent', eventType, paystackEventId });
    throw error;
  }
}

/**
 * Mark payment event as processed
 * @param {string} eventId
 */
async function markPaymentEventProcessed(eventId) {
  try {
    await supabaseAdmin
      .from('payment_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId);
  } catch (error) {
    logger.logError(error, { context: 'markPaymentEventProcessed', eventId });
  }
}

module.exports = {
  logAdminAction,
  recordPaymentEvent,
  markPaymentEventProcessed,
};
