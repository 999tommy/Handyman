const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * SMS Service
 * 
 * Handles SMS sending via Twilio or Africa's Talking
 */

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(to, message) {
  try {
    const accountSid = config.sms.accountSid;
    const authToken = config.sms.apiKey;
    const from = config.sms.senderId;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await axios.post(
      url,
      new URLSearchParams({
        To: to,
        From: from,
        Body: message,
      }),
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
      }
    );

    logger.info(`SMS sent via Twilio to ${to}`);
    return response.data;
  } catch (error) {
    logger.error('Twilio SMS error:', error.message);
    throw error;
  }
}

/**
 * Send SMS via Africa's Talking
 */
async function sendViaAfricasTalking(to, message) {
  try {
    const apiKey = config.sms.apiKey;
    const username = 'sandbox'; // Change to your username in production

    const url = 'https://api.africastalking.com/version1/messaging';

    const response = await axios.post(
      url,
      new URLSearchParams({
        username,
        to,
        message,
      }),
      {
        headers: {
          'apiKey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    logger.info(`SMS sent via Africa's Talking to ${to}`);
    return response.data;
  } catch (error) {
    logger.error("Africa's Talking SMS error:", error.message);
    throw error;
  }
}

/**
 * Send SMS (router function)
 * @param {string} to - Phone number in international format
 * @param {string} message - SMS message
 * @returns {Promise<Object>}
 */
async function sendSMS(to, message) {
  try {
    // In development, just log the SMS
    if (config.nodeEnv === 'development') {
      logger.info(`[DEV SMS] To: ${to}, Message: ${message}`);
      return { success: true, dev: true };
    }

    // Send via configured provider
    if (config.sms.provider === 'twilio') {
      return await sendViaTwilio(to, message);
    } else if (config.sms.provider === 'africastalking') {
      return await sendViaAfricasTalking(to, message);
    } else {
      throw new Error('No SMS provider configured');
    }
  } catch (error) {
    logger.logError(error, { context: 'sendSMS' });
    throw error;
  }
}

module.exports = {
  sendSMS,
};
