const { supabase } = require('../config/supabase');
const { NotFoundError, ValidationError, ConflictError } = require('../middleware/errorHandler');
const { JOB_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

/**
 * Review Service
 * 
 * Business logic for ratings and reviews
 */

/**
 * Create a review
 * @param {string} reviewerId 
 * @param {Object} reviewData 
 * @returns {Promise<Object>}
 */
async function createReview(reviewerId, reviewData) {
  try {
    const { job_id, reviewee_id, rating, comment } = reviewData;

    // Verify job exists and is completed
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('customer_id, assigned_artisan_id, status')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new NotFoundError('Job');
    }

    if (job.status !== JOB_STATUS.COMPLETED) {
      throw new ValidationError('Can only review completed jobs');
    }

    // Verify reviewer is part of the job
    const isCustomer = job.customer_id === reviewerId;
    const isArtisan = job.assigned_artisan_id === reviewerId;

    if (!isCustomer && !isArtisan) {
      throw new ValidationError('You can only review jobs you are part of');
    }

    // Verify reviewee is the other party
    const validReviewee = isCustomer ? job.assigned_artisan_id : job.customer_id;
    if (reviewee_id !== validReviewee) {
      throw new ValidationError('Invalid reviewee');
    }

    // Check for existing review
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('job_id', job_id)
      .eq('reviewer_id', reviewerId)
      .single();

    if (existingReview) {
      throw new ConflictError('You have already reviewed this job');
    }

    // Verify payment is released (optional but recommended)
    const { data: payment } = await supabase
      .from('payments')
      .select('status')
      .eq('job_id', job_id)
      .single();

    if (payment && payment.status !== PAYMENT_STATUS.RELEASED) {
      throw new ValidationError('Payment must be released before reviewing');
    }

    // Create review
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        job_id,
        reviewer_id: reviewerId,
        reviewee_id,
        rating,
        comment,
      })
      .select()
      .single();

    if (error) {
      logger.error('Review creation error:', error);
      throw new Error('Failed to create review');
    }

    // Notify reviewee
    await notificationService.sendNotification(
      reviewee_id,
      'review_received',
      'New Review',
      `You received a ${rating}-star review`,
      { job_id }
    );

    logger.info(`Review created: ${review.id} for job ${job_id}`);

    return review;
  } catch (error) {
    logger.logError(error, { context: 'createReview' });
    throw error;
  }
}

/**
 * Get reviews for a user
 * @param {string} userId 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function getUserReviews(userId, options = {}) {
  try {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const { data: reviews, error, count } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviewer_id(full_name, profile_picture_url),
        job:jobs(id, title)
      `, { count: 'exact' })
      .eq('reviewee_id', userId)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch reviews');
    }

    // Get rating breakdown
    const ratingBreakdown = await getRatingBreakdown(userId);

    return {
      reviews,
      rating_breakdown: ratingBreakdown,
      pagination: {
        total: count,
        page,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'getUserReviews' });
    throw error;
  }
}

/**
 * Get rating breakdown
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getRatingBreakdown(userId) {
  try {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId)
      .eq('is_flagged', false);

    const breakdown = {
      5_stars: 0,
      4_stars: 0,
      3_stars: 0,
      2_stars: 0,
      1_star: 0,
    };

    reviews?.forEach(review => {
      breakdown[`${review.rating}_star${review.rating !== 1 ? 's' : ''}`]++;
    });

    // Calculate average
    const total = reviews?.length || 0;
    const sum = reviews?.reduce((acc, r) => acc + r.rating, 0) || 0;
    const average = total > 0 ? (sum / total).toFixed(1) : 0;

    return {
      ...breakdown,
      total_reviews: total,
      average_rating: parseFloat(average),
    };
  } catch (error) {
    logger.logError(error, { context: 'getRatingBreakdown' });
    return null;
  }
}

/**
 * Flag a review
 * @param {string} reviewId 
 * @param {string} userId 
 * @param {string} reason 
 * @returns {Promise<Object>}
 */
async function flagReview(reviewId, userId, reason) {
  try {
    const { data: review } = await supabase
      .from('reviews')
      .select('reviewee_id')
      .eq('id', reviewId)
      .single();

    if (!review) {
      throw new NotFoundError('Review');
    }

    // Only the reviewee can flag
    if (review.reviewee_id !== userId) {
      throw new ValidationError('You can only flag reviews about you');
    }

    const { error } = await supabase
      .from('reviews')
      .update({
        is_flagged: true,
        flag_reason: reason,
      })
      .eq('id', reviewId);

    if (error) {
      throw new Error('Failed to flag review');
    }

    logger.info(`Review flagged: ${reviewId}`);

    return { message: 'Review flagged for admin review' };
  } catch (error) {
    logger.logError(error, { context: 'flagReview' });
    throw error;
  }
}

module.exports = {
  createReview,
  getUserReviews,
  getRatingBreakdown,
  flagReview,
};
