const axios = require('axios');
const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const config = require('../config/env');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { PAYMENT_STATUS, JOB_STATUS } = require('../utils/constants');
const { calculatePlatformFee, generateReference } = require('../utils/helpers');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const { logAdminAction, recordPaymentEvent, markPaymentEventProcessed } = require('./auditService');

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
    const { job_id, amount, callback_url } = paymentData;

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

    // Initialize Paystack payment with deep link or custom callback URL
    const paystackResponse = await initializePaystackPayment(
      amount,
      customerId,
      reference,
      callback_url
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
 * @param {string} [customCallbackUrl]
 * @returns {Promise<Object>}
 */
async function initializePaystackPayment(amount, customerId, reference, customCallbackUrl = null) {
  try {
    // Get customer email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', customerId)
      .single();

    const { data: user } = await supabase.auth.admin.getUserById(customerId);

    // Use custom callback_url, config callbackUrl, or mobile deep link
    const effectiveCallbackUrl = customCallbackUrl || config.paystack.callbackUrl || 'handyman://payment/callback';

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.user.email,
        amount: amount * 100, // Paystack uses kobo (smallest currency unit)
        reference,
        callback_url: effectiveCallbackUrl,
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
 * @param {number} [tipAmount] 
 * @returns {Promise<Object>}
 */
async function releasePayment(paymentId, customerId, tipAmount = 0) {
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

    let tipCheckout = null;
    if (tipAmount > 0) {
      const reference = generateReference('TIP');
      const { data: tipRecord, error: tipError } = await supabaseAdmin
        .from('payments')
        .insert({
          job_id: payment.job_id,
          customer_id: customerId,
          artisan_id: payment.artisan_id,
          amount: tipAmount,
          platform_fee: 0,
          artisan_payout: tipAmount,
          transaction_reference: reference,
          status: PAYMENT_STATUS.PENDING,
        })
        .select()
        .single();

      if (!tipError) {
        try {
          const paystackResponse = await initializePaystackPayment(
            tipAmount,
            customerId,
            reference
          );
          tipCheckout = {
            payment_id: tipRecord.id,
            authorization_url: paystackResponse.authorization_url,
            access_code: paystackResponse.access_code,
            reference,
          };
        } catch (initErr) {
          logger.error('Failed to initialize tip checkout:', initErr);
        }
      } else {
        logger.error('Failed to create tip payment record:', tipError);
      }
    }

    return {
      message: 'Payment released to artisan',
      status: PAYMENT_STATUS.RELEASED,
      tip_checkout: tipCheckout,
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
      payments: payments || [],
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

/**
 * Handle Paystack webhook events
 * @param {Object} headers
 * @param {string} rawBody
 * @param {Object} payload
 */
async function handlePaystackWebhook(headers, rawBody, payload) {
  try {
    const signature = headers['x-paystack-signature'];

    if (!signature || !rawBody) {
      throw new ValidationError('Missing webhook signature');
    }

    const verified = verifyPaystackSignature(signature, rawBody);

    if (!verified) {
      throw new ValidationError('Invalid webhook signature');
    }

    const eventType = payload?.event;
    const eventStatus = payload?.data?.status;
    const reference = payload?.data?.reference;
    const paystackEventId = payload?.data?.id || reference || `${eventType}-${payload?.data?.transaction_date}`;

    const payment = reference ? await findPaymentByReference(reference) : null;

    const eventRecord = await recordPaymentEvent({
      paystackEventId,
      eventType,
      eventStatus,
      payload,
      paymentId: payment?.id,
    });

    if (!eventRecord) {
      // Duplicate event
      return;
    }

    switch (eventType) {
      case 'charge.success':
        await handleChargeSuccess(payment, payload.data);
        break;
      case 'charge.failed':
        await handleChargeFailed(payment, payload.data);
        break;
      case 'dispute.create':
      case 'dispute.created':
        await handleDisputeCreated(payment, payload.data);
        break;
      case 'dispute.resolve':
      case 'dispute.resolved':
        await handleDisputeResolved(payment, payload.data);
        break;
      default:
        logger.info(`Unhandled Paystack event: ${eventType}`);
    }

    await markPaymentEventProcessed(eventRecord.id);
  } catch (error) {
    logger.logError(error, { context: 'handlePaystackWebhook' });
    throw error;
  }
}

/**
 * Verify Paystack webhook signature
 * @param {string} signature 
 * @param {string|Buffer} rawBody 
 * @returns {boolean}
 */
function verifyPaystackSignature(signature, rawBody) {
  const hash = crypto
    .createHmac('sha512', config.paystack.secretKey)
    .update(rawBody)
    .digest('hex');

  return hash === signature;
}

/**
 * Find payment by Paystack reference
 * @param {string} reference 
 * @returns {Promise<Object|null>}
 */
async function findPaymentByReference(reference) {
  if (!reference) return null;

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, job:jobs(id, status), artisan_id')
    .eq('transaction_reference', reference)
    .single();

  return payment || null;
}

async function handleChargeSuccess(payment, paystackData) {
  if (!payment) {
    logger.warn('Charge success for unknown payment reference', paystackData?.reference);
    return;
  }

  if ([PAYMENT_STATUS.HELD, PAYMENT_STATUS.RELEASED].includes(payment.status)) {
    return;
  }

  await supabaseAdmin
    .from('payments')
    .update({
      status: PAYMENT_STATUS.HELD,
      gateway_response: paystackData,
      held_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (payment.job?.id && payment.job.status !== JOB_STATUS.COMPLETED) {
    await supabaseAdmin
      .from('jobs')
      .update({ status: JOB_STATUS.IN_PROGRESS })
      .eq('id', payment.job.id);
  }

  await notificationService.sendNotification(
    payment.artisan_id,
    'payment_received',
    'Payment Secured',
    'Payment has been held in escrow. You can now start the job.',
    { job_id: payment.job?.id }
  );
}

async function handleChargeFailed(payment, paystackData) {
  if (!payment) {
    logger.warn('Charge failed for unknown reference', paystackData?.reference);
    return;
  }

  await supabaseAdmin
    .from('payments')
    .update({
      status: PAYMENT_STATUS.FAILED,
      gateway_response: paystackData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id);
}

async function handleDisputeCreated(payment, data) {
  if (!payment) return;

  await supabaseAdmin
    .from('payments')
    .update({
      status: PAYMENT_STATUS.DISPUTED,
      gateway_response: data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (payment.job?.id) {
    await supabaseAdmin
      .from('jobs')
      .update({ status: JOB_STATUS.DISPUTED })
      .eq('id', payment.job.id);
  }
}

async function handleDisputeResolved(payment, data) {
  if (!payment) return;

  const resolution = data?.resolution;
  let statusUpdate = {};

  if (resolution === 'merchant_won') {
    statusUpdate = {
      status: PAYMENT_STATUS.HELD,
    };
  } else if (resolution === 'customer_won') {
    statusUpdate = {
      status: PAYMENT_STATUS.REFUNDED,
      refunded_at: new Date().toISOString(),
    };
  }

  if (Object.keys(statusUpdate).length > 0) {
    await supabaseAdmin
      .from('payments')
      .update({
        ...statusUpdate,
        gateway_response: data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);
  }
}

/**
 * Admin override release
 */
async function adminReleasePayment(paymentId, adminId, options = {}) {
  const { platform_fee, artisan_payout, reason } = options;

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select(`
      *,
      job:jobs(id, status, customer_id)
    `)
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new NotFoundError('Payment');
  }

  const finalPlatformFee = platform_fee ?? payment.platform_fee;
  const finalArtisanPayout = artisan_payout ?? payment.artisan_payout;

  const updates = {
    status: PAYMENT_STATUS.RELEASED,
    released_at: new Date().toISOString(),
    admin_override_by: adminId,
    admin_override_reason: reason || 'Manual release by admin',
    admin_override_at: new Date().toISOString(),
    platform_fee_override: platform_fee ?? payment.platform_fee_override,
    artisan_payout_override: artisan_payout ?? payment.artisan_payout_override,
    platform_fee: finalPlatformFee,
    artisan_payout: finalArtisanPayout,
  };

  await supabaseAdmin
    .from('payments')
    .update(updates)
    .eq('id', paymentId);

  await supabaseAdmin.rpc('increment_artisan_earnings', {
    artisan_id: payment.artisan_id,
    amount: finalArtisanPayout,
  });

  await notificationService.sendNotification(
    payment.artisan_id,
    'payment_received',
    'Payment Released! 💰',
    `₦${Number(finalArtisanPayout).toLocaleString()} has been released to you`,
    { job_id: payment.job?.id }
  );

  await logAdminAction({
    adminId,
    action: 'payment_release',
    targetType: 'payment',
    targetId: paymentId,
    metadata: { reason, platform_fee: finalPlatformFee, artisan_payout: finalArtisanPayout },
  });

  return {
    message: 'Payment released by admin',
    status: PAYMENT_STATUS.RELEASED,
  };
}

/**
 * Admin refund override
 */
async function adminRefundPayment(paymentId, adminId, reason) {
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new NotFoundError('Payment');
  }

  await supabaseAdmin
    .from('payments')
    .update({
      status: PAYMENT_STATUS.REFUNDED,
      refunded_at: new Date().toISOString(),
      admin_override_by: adminId,
      admin_override_reason: reason || 'Manual refund by admin',
      admin_override_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  await logAdminAction({
    adminId,
    action: 'payment_refund',
    targetType: 'payment',
    targetId: paymentId,
    metadata: { reason },
  });

  return {
    message: 'Payment refunded by admin',
    status: PAYMENT_STATUS.REFUNDED,
  };
}

/**
 * List payments for admin panel
 */
async function listPayments(options = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    date_from,
    date_to,
    sort = 'created_at',
    order = 'desc',
  } = options;

  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('payments')
    .select(`
      *,
      job:jobs(id, title, status),
      customer:profiles!payments_customer_id_fkey(full_name),
      artisan:profiles!payments_artisan_id_fkey(full_name)
    `, { count: 'exact' })
    .order(sort, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (date_from) {
    query = query.gte('created_at', date_from);
  }

  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  if (search) {
    query = query.ilike('transaction_reference', `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error('Failed to fetch payments');
  }

  return {
    payments: data || [],
    pagination: {
      total: count,
      page,
      pages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * Payment metrics for admin dashboard
 */
async function getPaymentMetrics(options = {}) {
  const { range = 30 } = options;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - range);

  const [released, held, disputed] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('amount, platform_fee')
      .eq('status', PAYMENT_STATUS.RELEASED),
    supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', PAYMENT_STATUS.HELD),
    supabaseAdmin
      .from('payments')
      .select('id')
      .eq('status', PAYMENT_STATUS.DISPUTED),
  ]);

  const { data: recent } = await supabaseAdmin
    .from('payments')
    .select('amount, platform_fee')
    .gte('created_at', sinceDate.toISOString());

  const sumAmount = arr => arr?.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 0;
  const sumFees = arr => arr?.reduce((sum, row) => sum + Number(row.platform_fee || 0), 0) || 0;

  return {
    total_released_volume: sumAmount(released.data),
    total_released_fees: sumFees(released.data),
    held_volume: sumAmount(held.data),
    disputed_count: disputed.data?.length || 0,
    recent_volume: sumAmount(recent),
    recent_fees: sumFees(recent),
    range_days: range,
  };
}

/**
 * Get artisan wallet balance & bank details
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getWalletBalance(userId) {
  try {
    // 1. Find artisan record
    const { data: artisan, error: artisanError } = await supabaseAdmin
      .from('artisans')
      .select('id, bank_name, account_number, account_name, total_earnings')
      .eq('id', userId)
      .single();

    if (artisanError || !artisan) {
      throw new NotFoundError('Artisan profile not found');
    }

    // 2. Query payments for this artisan
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('amount, artisan_payout, status')
      .eq('artisan_id', userId);

    if (paymentsError) {
      logger.error('Error fetching artisan payments for balance:', paymentsError);
    }

    const releasedTotal = payments
      ? payments
          .filter(p => p.status === PAYMENT_STATUS.RELEASED)
          .reduce((sum, p) => sum + Number(p.artisan_payout || 0), 0)
      : Number(artisan.total_earnings || 0);

    const heldTotal = payments
      ? payments
          .filter(p => p.status === PAYMENT_STATUS.HELD)
          .reduce((sum, p) => sum + Number(p.artisan_payout || 0), 0)
      : 0;

    const pendingTotal = payments
      ? payments
          .filter(p => p.status === PAYMENT_STATUS.PENDING)
          .reduce((sum, p) => sum + Number(p.artisan_payout || 0), 0)
      : 0;

    // 3. Query withdrawals if table exists
    let totalWithdrawn = 0;
    try {
      const { data: withdrawals, error: withError } = await supabaseAdmin
        .from('withdrawals')
        .select('amount, status')
        .eq('artisan_id', userId)
        .in('status', ['pending', 'processing', 'completed']);

      if (!withError && withdrawals) {
        totalWithdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
      }
    } catch (err) {
      logger.debug('Withdrawals table query fallback:', err.message);
    }

    const availableBalance = Math.max(0, releasedTotal - totalWithdrawn);

    return {
      available_balance: availableBalance,
      pending_balance: heldTotal,
      escrow_held_balance: heldTotal,
      pending_payment_balance: pendingTotal,
      total_earned: releasedTotal,
      total_withdrawn: totalWithdrawn,
      currency: 'NGN',
      bank_details: {
        bank_name: artisan.bank_name || null,
        bank_account_number: artisan.account_number || null,
        account_name: artisan.account_name || null,
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'getWalletBalance' });
    throw error;
  }
}

/**
 * Request artisan bank withdrawal
 * @param {string} userId 
 * @param {Object} data 
 * @returns {Promise<Object>}
 */
async function requestWithdrawal(userId, data) {
  try {
    const { amount, bank_account_number, bank_name, account_name } = data || {};

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      throw new ValidationError('A valid withdrawal amount greater than 0 is required');
    }

    const MIN_WITHDRAWAL = 1000;
    if (numAmount < MIN_WITHDRAWAL) {
      throw new ValidationError(`Minimum withdrawal amount is ₦${MIN_WITHDRAWAL.toLocaleString()}`);
    }

    // Check available balance
    const wallet = await getWalletBalance(userId);
    if (numAmount > wallet.available_balance) {
      throw new ValidationError(`Insufficient wallet balance. Available: ₦${wallet.available_balance.toLocaleString()}`);
    }

    // Resolve bank details (either from payload or from saved profile)
    const effectiveBankName = bank_name || wallet.bank_details.bank_name;
    const effectiveAccountNumber = bank_account_number || wallet.bank_details.bank_account_number;
    const effectiveAccountName = account_name || wallet.bank_details.account_name;

    if (!effectiveBankName || !effectiveAccountNumber) {
      throw new ValidationError('Bank name and account number are required for withdrawal');
    }

    // Update artisan bank details if provided
    if (bank_name || bank_account_number || account_name) {
      await supabaseAdmin
        .from('artisans')
        .update({
          bank_name: effectiveBankName,
          account_number: effectiveAccountNumber,
          account_name: effectiveAccountName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    const reference = generateReference('WTH');

    let withdrawalRecord = null;
    try {
      const { data: withdrawal, error: insertError } = await supabaseAdmin
        .from('withdrawals')
        .insert({
          artisan_id: userId,
          amount: numAmount,
          currency: 'NGN',
          bank_name: effectiveBankName,
          bank_account_number: effectiveAccountNumber,
          account_name: effectiveAccountName,
          status: 'pending',
          reference,
        })
        .select()
        .single();

      if (!insertError && withdrawal) {
        withdrawalRecord = withdrawal;
      }
    } catch (wErr) {
      logger.warn('Withdrawals table insert failed, falling back to audit log:', wErr.message);
    }

    if (!withdrawalRecord) {
      // Fallback: log in admin_audit_logs so request is securely recorded
      await logAdminAction({
        adminId: null,
        action: 'artisan_withdrawal_request',
        targetType: 'artisan',
        targetId: userId,
        metadata: {
          reference,
          amount: numAmount,
          bank_name: effectiveBankName,
          bank_account_number: effectiveAccountNumber,
          account_name: effectiveAccountName,
          status: 'pending',
          requested_at: new Date().toISOString(),
        },
      });
    }

    // Send notification
    try {
      await notificationService.sendNotification(
        userId,
        'withdrawal_requested',
        'Withdrawal Processing',
        `Your withdrawal request of ₦${numAmount.toLocaleString()} has been received and is being processed.`,
        { reference, amount: numAmount }
      );
    } catch (notifErr) {
      logger.warn('Failed to send withdrawal notification:', notifErr.message);
    }

    logger.info(`Withdrawal requested: ₦${numAmount} for artisan ${userId} (${reference})`);

    return {
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        id: withdrawalRecord?.id || reference,
        amount: numAmount,
        currency: 'NGN',
        status: 'pending',
        reference,
        bank_name: effectiveBankName,
        bank_account_number: effectiveAccountNumber,
        account_name: effectiveAccountName,
        created_at: new Date().toISOString(),
      },
      available_balance_remaining: wallet.available_balance - numAmount,
    };
  } catch (error) {
    logger.logError(error, { context: 'requestWithdrawal' });
    throw error;
  }
}

module.exports = {
  initiatePayment,
  verifyPayment,
  releasePayment,
  requestRefund,
  getPaymentHistory,
  handlePaystackWebhook,
  adminReleasePayment,
  adminRefundPayment,
  listPayments,
  getPaymentMetrics,
  getWalletBalance,
  requestWithdrawal,
};
