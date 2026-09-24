const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * SMS Service — Africa's Talking
 *
 * All OTP / verification SMS is sent via Africa's Talking.
 *
 * Sandbox vs Live:
 *   - Sandbox  → AFRICA_TALKING_USERNAME=sandbox   (no real SMS, visible in AT dashboard)
 *   - Live     → AFRICA_TALKING_USERNAME=<your AT username>
 *
 * Docs: https://developers.africastalking.com/docs/sms/sending
 */

const AT_SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';
const AT_LIVE_URL    = 'https://api.africastalking.com/version1/messaging';

/**
 * Send an SMS via Africa's Talking
 * @param {string} to      - E.164 phone number, e.g. +2347047027012
 * @param {string} message - SMS body (keep under 160 chars to avoid multi-part billing)
 * @returns {Promise<Object>}
 */
async function sendViaAfricasTalking(to, message) {
  const apiKey   = config.sms.apiKey;
  const username = config.sms.username;

  if (!apiKey) {
    throw new Error('AFRICA_TALKING_KEY is not set in environment variables');
  }

  const isSandbox = username === 'sandbox';
  const url       = isSandbox ? AT_SANDBOX_URL : AT_LIVE_URL;

  const params = new URLSearchParams({
    username,
    to,
    message,
  });

  // Only set a Sender ID on the live environment (sandbox ignores / rejects it)
  if (!isSandbox && config.sms.senderId) {
    params.set('from', config.sms.senderId);
  }

  try {
    const response = await axios.post(url, params.toString(), {
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const result = response.data?.SMSMessageData;
    
    // Check if AT returned an error like InvalidSenderId
    if (result?.Message === 'InvalidSenderId') {
      logger.error(`Africa's Talking error: Sender ID "${config.sms.senderId}" is not registered/approved yet on your AT account.`);
      throw new Error(`Sender ID "${config.sms.senderId}" is not registered or approved on Africa's Talking.`);
    }

    const recipient = result?.Recipients?.[0];
    logger.info(`SMS sent via Africa's Talking to ${to} [${isSandbox ? 'SANDBOX' : 'LIVE'}]: ${recipient?.status || result?.Message}`);
    logger.debug('AT response:', JSON.stringify(result));

    // Check if AT itself reported a delivery failure for the recipient
    if (recipient && recipient.status !== 'Success' && recipient.status !== 'Submitted') {
      logger.warn(`AT delivery warning for ${to}: ${recipient.status} — ${recipient.statusCode}`);
      throw new Error(`SMS delivery failed: ${recipient.status} (code ${recipient.statusCode})`);
    }

    return result;
  } catch (error) {
    const atError = error.response?.data || error.message;
    logger.error("Africa's Talking SMS error:", atError);
    throw new Error(`SMS delivery failed: ${typeof atError === 'object' ? JSON.stringify(atError) : atError}`);
  }
}

/**
 * Send an SMS (main entry point)
 * @param {string} to      - Phone number in E.164 international format (+2347XXXXXXXXX)
 * @param {string} message - SMS body
 * @returns {Promise<Object>}
 */
async function sendSMS(to, message) {
  // If no AT key is configured (e.g. fresh local clone without credentials), log mock in dev
  if (!config.sms.apiKey && config.nodeEnv === 'development') {
    logger.info(`[MOCK DEV SMS - No API Key] To: ${to} | Message: ${message}`);
    return { success: true, dev: true };
  }

  return sendViaAfricasTalking(to, message);
}

module.exports = { sendSMS };
