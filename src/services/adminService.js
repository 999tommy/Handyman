const { supabase, supabaseAdmin } = require('../config/supabase');
const { NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');
const { APPROVAL_STATUS, JOB_STATUS, PAYMENT_STATUS, PAGINATION } = require('../utils/constants');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const paymentService = require('./paymentService');
const { logAdminAction } = require('./auditService');

function normalizePagination(options = {}) {
  const page = Math.max(parseInt(options.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = Math.min(
    Math.max(parseInt(options.limit, 10) || PAGINATION.DEFAULT_LIMIT, 1),
    PAGINATION.MAX_LIMIT
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPagination(count = 0, page, limit) {
  return {
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
    limit,
  };
}

/**
 * Admin Service
 * 
 * Business logic for admin operations
 */

/**
 * Get pending artisan applications
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getPendingArtisans(options = {}) {
  try {
    const { page, limit, offset } = normalizePagination(options);

    const { data: artisans, error, count } = await supabaseAdmin
      .from('artisans')
      .select(`
        *,
        profile:profiles(full_name, email, phone_number, created_at),
        category:categories(name)
      `, { count: 'exact' })
      .eq('approval_status', APPROVAL_STATUS.PENDING)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch pending artisans');
    }

    return {
      artisans: artisans || [],
      pagination: buildPagination(count, page, limit),
    };
  } catch (error) {
    logger.logError(error, { context: 'getPendingArtisans' });
    throw error;
  }
}

/**
 * Approve artisan
 * @param {string} artisanId 
 * @param {string} adminId 
 * @returns {Promise<Object>}
 */
async function approveArtisan(artisanId, adminId) {
  try {
    // Get artisan details
    const { data: artisan, error: artisanError } = await supabaseAdmin
      .from('artisans')
      .select('id, approval_status, profiles(full_name)')
      .eq('id', artisanId)
      .single();

    if (artisanError || !artisan) {
      throw new NotFoundError('Artisan');
    }

    if (artisan.approval_status !== APPROVAL_STATUS.PENDING) {
      throw new ForbiddenError('Artisan application is not pending');
    }

    // Update approval status
    const { error } = await supabaseAdmin
      .from('artisans')
      .update({
        approval_status: APPROVAL_STATUS.APPROVED,
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', artisanId);

    if (error) {
      throw new Error('Failed to approve artisan');
    }

    // Notify artisan
    await notificationService.sendNotification(
      artisanId,
      'artisan_approved',
      'Application Approved! 🎉',
      'Your artisan application has been approved. You can now start bidding on jobs.',
      null
    );

    logger.info(`Artisan approved: ${artisanId} by admin ${adminId}`);

    return {
      message: 'Artisan approved successfully',
      artisan_id: artisanId,
    };
  } catch (error) {
    logger.logError(error, { context: 'approveArtisan' });
    throw error;
  }
}

/**
 * Reject artisan application
 * @param {string} artisanId 
 * @param {string} adminId 
 * @param {string} reason 
 * @returns {Promise<Object>}
 */
async function rejectArtisan(artisanId, adminId, reason) {
  try {
    const { data: artisan } = await supabaseAdmin
      .from('artisans')
      .select('approval_status')
      .eq('id', artisanId)
      .single();

    if (!artisan) {
      throw new NotFoundError('Artisan');
    }

    if (artisan.approval_status !== APPROVAL_STATUS.PENDING) {
      throw new ForbiddenError('Artisan application is not pending');
    }

    // Update status
    const { error } = await supabaseAdmin
      .from('artisans')
      .update({
        approval_status: APPROVAL_STATUS.REJECTED,
        rejection_reason: reason,
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', artisanId);

    if (error) {
      throw new Error('Failed to reject artisan');
    }

    // Notify artisan
    await notificationService.sendNotification(
      artisanId,
      'artisan_rejected',
      'Application Not Approved',
      `Your application was not approved. Reason: ${reason}`,
      null
    );

    logger.info(`Artisan rejected: ${artisanId} by admin ${adminId}`);

    return {
      message: 'Artisan application rejected',
      artisan_id: artisanId,
    };
  } catch (error) {
    logger.logError(error, { context: 'rejectArtisan' });
    throw error;
  }
}

/**
 * Get platform statistics
 * @returns {Promise<Object>}
 */
async function getPlatformStats() {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    // Total customers
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true });

    // Total artisans
    const { count: totalArtisans } = await supabase
      .from('artisans')
      .select('id', { count: 'exact', head: true });

    // Pending approvals
    const { count: pendingApprovals } = await supabase
      .from('artisans')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', APPROVAL_STATUS.PENDING);

    // Active jobs
    const { count: activeJobs } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['posted', 'assigned', 'in_progress']);

    // Completed jobs
    const { count: completedJobs } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Total revenue (platform fees)
    const { data: payments } = await supabase
      .from('payments')
      .select('platform_fee')
      .eq('status', 'released');

    const totalRevenue = payments?.reduce((sum, p) => sum + (p.platform_fee || 0), 0) || 0;

    // Monthly revenue (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyPayments } = await supabase
      .from('payments')
      .select('platform_fee')
      .eq('status', 'released')
      .gte('released_at', startOfMonth.toISOString());

    const monthlyRevenue = monthlyPayments?.reduce((sum, p) => sum + (p.platform_fee || 0), 0) || 0;

    return {
      total_users: totalUsers || 0,
      total_customers: totalCustomers || 0,
      total_artisans: totalArtisans || 0,
      pending_approvals: pendingApprovals || 0,
      active_jobs: activeJobs || 0,
      completed_jobs: completedJobs || 0,
      total_revenue: totalRevenue,
      monthly_revenue: monthlyRevenue,
    };
  } catch (error) {
    logger.logError(error, { context: 'getPlatformStats' });
    throw error;
  }
}

/**
 * Get flagged reviews
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getFlaggedReviews(options = {}) {
  try {
    const { page, limit, offset } = normalizePagination(options);

    const { data: reviews, error, count } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviewer_id(full_name),
        reviewee:profiles!reviewee_id(full_name),
        job:jobs(title)
      `, { count: 'exact' })
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch flagged reviews');
    }

    return {
      reviews: reviews || [],
      pagination: buildPagination(count, page, limit),
    };
  } catch (error) {
    logger.logError(error, { context: 'getFlaggedReviews' });
    throw error;
  }
}

/**
 * List users
 */
async function listUsers(options = {}) {
  try {
    const { page, limit, offset } = normalizePagination(options);
    const { role, search, sort = 'created_at', order = 'desc' } = options;

    let query = supabaseAdmin
      .from('profiles')
      .select(`
        *,
        customer:customers(id, total_jobs_posted, total_spent, average_rating),
        artisan:artisans(id, approval_status, verification_status, total_jobs_completed, total_earnings, average_rating)
      `, { count: 'exact' })
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq('role', role);
    }

    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error('Failed to fetch users');
    }

    return {
      users: data || [],
      pagination: buildPagination(count, page, limit),
    };
  } catch (error) {
    logger.logError(error, { context: 'listUsers' });
    throw error;
  }
}

/**
 * Get user profile details
 */
async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        customer:customers(*),
        artisan:artisans(*)
      `)
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundError('User');
    }

    return profile;
  } catch (error) {
    logger.logError(error, { context: 'getUserProfile' });
    throw error;
  }
}

/**
 * List jobs
 */
async function listJobs(options = {}) {
  try {
    const { page, limit, offset } = normalizePagination(options);
    const { status, search, customer_id, artisan_id, sort = 'created_at', order = 'desc' } = options;

    let query = supabaseAdmin
      .from('jobs')
      .select(`
        *,
        customer:profiles!jobs_customer_id_fkey(full_name),
        artisan:profiles!jobs_assigned_artisan_id_fkey(full_name)
      `, { count: 'exact' })
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (customer_id) query = query.eq('customer_id', customer_id);
    if (artisan_id) query = query.eq('assigned_artisan_id', artisan_id);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;

    if (error) throw new Error('Failed to fetch jobs');

    return {
      jobs: data || [],
      pagination: buildPagination(count, page, limit),
    };
  } catch (error) {
    logger.logError(error, { context: 'listJobs' });
    throw error;
  }
}

/**
 * Update job status (override)
 */
async function updateJobStatus(jobId, adminId, status, reason) {
  if (!Object.values(JOB_STATUS).includes(status)) {
    throw new ValidationError('Invalid job status');
  }

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    throw new NotFoundError('Job');
  }

  await supabaseAdmin
    .from('jobs')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  await logAdminAction({
    adminId,
    action: 'job_status_update',
    targetType: 'job',
    targetId: jobId,
    metadata: { previous_status: job.status, new_status: status, reason },
  });

  return { message: 'Job status updated', status };
}

/**
 * List offers
 */
async function listOffers(options = {}) {
  try {
    const { page, limit, offset } = normalizePagination(options);
    const { status, job_id, artisan_id } = options;

    let query = supabaseAdmin
      .from('offers')
      .select(`
        *,
        job:jobs(title, status),
        artisan:profiles!offers_artisan_id_fkey(full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (job_id) query = query.eq('job_id', job_id);
    if (artisan_id) query = query.eq('artisan_id', artisan_id);

    const { data, error, count } = await query;

    if (error) throw new Error('Failed to fetch offers');

    return {
      offers: data || [],
      pagination: buildPagination(count, page, limit),
    };
  } catch (error) {
    logger.logError(error, { context: 'listOffers' });
    throw error;
  }
}

/**
 * Update offer status
 */
async function updateOfferStatus(offerId, adminId, status, reason) {
  if (!status || typeof status !== 'string') {
    throw new ValidationError('Status is required');
  }

  const { data: offer, error } = await supabaseAdmin
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (error || !offer) {
    throw new NotFoundError('Offer');
  }

  await supabaseAdmin
    .from('offers')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  await logAdminAction({
    adminId,
    action: 'offer_status_update',
    targetType: 'offer',
    targetId: offerId,
    metadata: { previous_status: offer.status, new_status: status, reason },
  });

  return { message: 'Offer status updated', status };
}

/**
 * Admin payment listing
 */
async function adminListPayments(options = {}) {
  return paymentService.listPayments(options);
}

async function adminReleasePaymentWrapper(paymentId, adminId, overrides = {}) {
  return paymentService.adminReleasePayment(paymentId, adminId, overrides);
}

async function adminRefundPaymentWrapper(paymentId, adminId, reason) {
  return paymentService.adminRefundPayment(paymentId, adminId, reason);
}

async function getPaymentMetrics(options = {}) {
  return paymentService.getPaymentMetrics(options);
}

module.exports = {
  getPendingArtisans,
  approveArtisan,
  rejectArtisan,
  getPlatformStats,
  getFlaggedReviews,
  listUsers,
  getUserProfile,
  listJobs,
  updateJobStatus,
  listOffers,
  updateOfferStatus,
  adminListPayments,
  adminReleasePaymentWrapper,
  adminRefundPaymentWrapper,
  getPaymentMetrics,
};
