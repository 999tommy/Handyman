const { supabase, supabaseAdmin } = require('../config/supabase');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { APPROVAL_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

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
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

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
      artisans,
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
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
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

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
      reviews,
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'getFlaggedReviews' });
    throw error;
  }
}

module.exports = {
  getPendingArtisans,
  approveArtisan,
  rejectArtisan,
  getPlatformStats,
  getFlaggedReviews,
};
