const axios = require('axios');
const { supabase } = require('../config/supabase');
const config = require('../config/env');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { PAYMENT_STATUS, JOB_STATUS } = require('../utils/constants');
const { calculatePlatformFee, generateReference } = require('../utils/helpers');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

/**
 * Payment Service
 * 
 * Handles escrow payments via Paystack
 */

/**
 * Initialize payment (escrow)
 * @param {string} customerId 
 * @param {Object} paymentData 
 * @returns {Promise<Object>}
 */
async function initiatePayment(customerId, paymentData) {
  try {
    const { job_id, amount } = paymentData;

    // Verify job exists and belongs to customer
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('customer_id, assigned_artisan_id, status')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new NotFoundError('Job');
    }

    if (job.customer_id !== customerId) {
      throw new ValidationError('You can only pay for your own jobs');
    }

    if (!job.assigned_artisan_id) {
      throw new ValidationError('No artisan assigned to this job');
    }

    if (job.status !== JOB_STATUS.ASSIGNED) {
      throw new ValidationError('Job must be in assigned status to initiate payment');
    }

    // Calculate platform fee
    const { platformFee, artisanPayout } = calculatePlatformFee(
      amount,
      config.platform.feePercentage
    );

    // Generate transaction reference
    const reference = generateReference('TXN');

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        job_id,
        customer_id: customerId,
        artisan_id: job.assigned_artisan_id,
        amount,
        platform_fee: platformFee,
        artisan_payout: artisanPayout,
        transaction_reference: reference,
        status: PAYMENT_STATUS.PENDING,
      })
      .select()
      .single();

    if (paymentError) {
      logger.error('Payment creation error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    // Initialize Paystack payment
    const paystackResponse = await initializePaystackPayment(
      amount,
      customerId,
      reference
    );

    logger.info(`Payment initiated: ${payment.id} for job ${job_id}`);

    return {
      payment_id: payment.id,
      authorization_url: paystackResponse.authorization_url,
      access_code: paystackResponse.access_code,
      reference,
    };
  } catch (error) {
    logger.logError(error, { context: 'initiatePayment' });
    throw error;
  }
}

/**
 * Initialize Paystack payment
 * @param {number} amount 
 * @param {string} customerId 
 * @param {string} reference 
 * @returns {Promise<Object>}
 */
async function initializePaystackPayment(amount, customerId, reference) {
  try {
    // Get customer email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', customerId)
      .single();

    const { data: user } = await supabase.auth.admin.getUserById(customerId);

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.user.email,
        amount: amount * 100, // Paystack uses kobo (smallest currency unit)
        reference,
        callback_url: config.paystack.callbackUrl,
        metadata: {
          customer_id: customerId,
          customer_name: profile.full_name,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.paystack.secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.status) {
      throw new Error('Paystack initialization failed');
    }

    return response.data.data;
  } catch (error) {
    logger.logError(error, { context: 'initializePaystackPayment' });
    throw new Error('Payment gateway error');
  }
}

/**
 * Verify payment
 * @param {string} reference 
 * @returns {Promise<Object>}
 */
async function verifyPayment(reference) {
  try {
    // Verify with Paystack
    const paystackData = await verifyPaystackPayment(reference);

    if (paystackData.status !== 'success') {
      throw new ValidationError('Payment verification failed');
    }

    // Update payment record
    const { data: payment, error } = await supabase
      .from('payments')
      .update({
        status: PAYMENT_STATUS.HELD,
        gateway_response: paystackData,
        held_at: new Date().toISOString(),
      })
      .eq('transaction_reference', reference)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update payment status');
    }

    // Update job status to in_progress
    await supabase
      .from('jobs')
      .update({ status: JOB_STATUS.IN_PROGRESS })
      .eq('id', payment.job_id);

    // Notify artisan
    await notificationService.sendNotification(
      payment.artisan_id,
      'payment_received',
      'Payment Secured',
      'Payment has been held in escrow. You can now start the job.',
      { job_id: payment.job_id }
    );

    logger.info(`Payment verified and held: ${payment.id}`);

    return {
      status: PAYMENT_STATUS.HELD,
      message: 'Payment verified and held in escrow',
      payment,
    };
  } catch (error) {
    logger.logError(error, { context: 'verifyPayment' });
    throw error;
  }
}

/**
 * Verify Paystack payment
 * @param {string} reference 
 * @returns {Promise<Object>}
 */
async function verifyPaystackPayment(reference) {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${config.paystack.secretKey}`,
        },
      }
    );

    if (!response.data.status) {
      throw new Error('Paystack verification failed');
    }

    return response.data.data;
  } catch (error) {
    logger.logError(error, { context: 'verifyPaystackPayment' });
    throw new Error('Payment verification failed');
  }
}

/**
 * Release payment to artisan (after job completion)
 * @param {string} paymentId 
 * @param {string} customerId 
 * @returns {Promise<Object>}
 */
async function releasePayment(paymentId, customerId) {
  try {
    // Get payment
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        *,
        job:jobs(customer_id, status)
      `)
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new NotFoundError('Payment');
    }

    // Verify customer owns the job
    if (payment.job.customer_id !== customerId) {
      throw new ValidationError('Unauthorized to release this payment');
    }

    // Verify payment is held
    if (payment.status !== PAYMENT_STATUS.HELD) {
      throw new ValidationError('Payment is not in held status');
    }

    // Verify job is completed
    if (payment.job.status !== JOB_STATUS.COMPLETED) {
      throw new ValidationError('Job must be completed before releasing payment');
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: PAYMENT_STATUS.RELEASED,
        released_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to release payment');
    }

    // Update artisan earnings
    await supabase.rpc('increment_artisan_earnings', {
      artisan_id: payment.artisan_id,
      amount: payment.artisan_payout,
    });

    // Notify artisan
    await notificationService.sendNotification(
      payment.artisan_id,
      'payment_received',
      'Payment Released! 💰',
      `₦${payment.artisan_payout.toLocaleString()} has been released to you`,
      { job_id: payment.job_id }
    );

    logger.info(`Payment released: ${paymentId}`);

    return {
      message: 'Payment released to artisan',
      status: PAYMENT_STATUS.RELEASED,
    };
  } catch (error) {
    logger.logError(error, { context: 'releasePayment' });
    throw error;
  }
}

/**
 * Request refund
 * @param {string} paymentId 
 * @param {string} customerId 
 * @param {string} reason 
 * @returns {Promise<Object>}
 */
async function requestRefund(paymentId, customerId, reason) {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.customer_id !== customerId) {
      throw new ValidationError('Unauthorized');
    }

    if (payment.status === PAYMENT_STATUS.RELEASED) {
      throw new ValidationError('Cannot refund released payment');
    }

    // In production, integrate with Paystack refund API
    // For now, just mark as refunded
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: PAYMENT_STATUS.REFUNDED,
        refunded_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to process refund');
    }

    logger.info(`Refund processed: ${paymentId}`);

    return {
      message: 'Refund processed successfully',
      status: PAYMENT_STATUS.REFUNDED,
    };
  } catch (error) {
    logger.logError(error, { context: 'requestRefund' });
    throw error;
  }
}

/**
 * Get payment history
 * @param {string} userId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getPaymentHistory(userId, options = {}) {
  try {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data: payments, error, count } = await supabase
      .from('payments')
      .select(`
        *,
        job:jobs(id, title)
      `, { count: 'exact' })
      .or(`customer_id.eq.${userId},artisan_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch payment history');
    }

    return {
      payments,
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'getPaymentHistory' });
    throw error;
  }
}

module.exports = {
  initiatePayment,
  verifyPayment,
  releasePayment,
  requestRefund,
  getPaymentHistory,
};
