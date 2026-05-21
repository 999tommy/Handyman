const { supabase, supabaseAdmin } = require('../config/supabase');
const { NotFoundError, ForbiddenError, ValidationError, ConflictError } = require('../middleware/errorHandler');
const { OFFER_STATUS, JOB_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const chatService = require('./chatService');

/**
 * Offer Service
 * 
 * Business logic for bidding/offer management
 */

/**
 * Create an offer (artisan bids on job)
 * @param {string} artisanId 
 * @param {Object} offerData 
 * @returns {Promise<Object>}
 */
async function createOffer(artisanId, offerData) {
  try {
    const { job_id, proposed_price, cover_letter, estimated_duration } = offerData;

    // Verify job exists and is open for offers
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, customer_id, status, title')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new NotFoundError('Job');
    }

    if (job.status !== JOB_STATUS.POSTED) {
      throw new ValidationError('This job is no longer accepting offers');
    }

    // Check if artisan already made an offer
    const { data: existingOffer } = await supabase
      .from('offers')
      .select('id')
      .eq('job_id', job_id)
      .eq('artisan_id', artisanId)
      .single();

    if (existingOffer) {
      throw new ConflictError('You have already submitted an offer for this job');
    }

    // Create offer
    const { data: offer, error } = await supabase
      .from('offers')
      .insert({
        job_id,
        artisan_id,
        proposed_price,
        cover_letter,
        estimated_duration,
        status: OFFER_STATUS.PENDING,
      })
      .select()
      .single();

    if (error) {
      logger.error('Offer creation error:', error);
      throw new Error('Failed to create offer');
    }

    // Update job offer count
    await supabase.rpc('increment_job_offers', { job_id });

    // Notify customer
    await notificationService.sendNotification(
      job.customer_id,
      'offer_received',
      'New Offer Received',
      `You received a new offer for "${job.title}"`,
      { job_id, offer_id: offer.id }
    );

    logger.info(`Offer created: ${offer.id} by artisan ${artisanId} for job ${job_id}`);

    return offer;
  } catch (error) {
    logger.logError(error, { context: 'createOffer' });
    throw error;
  }
}

/**
 * Get offers for a job
 * @param {string} jobId 
 * @param {string} userId - Current user (must be job owner or artisan who made offer)
 * @returns {Promise<Array>}
 */
async function getJobOffers(jobId, userId) {
  try {
    // Verify user has access to view offers
    const { data: job } = await supabase
      .from('jobs')
      .select('customer_id')
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new NotFoundError('Job');
    }

    const isCustomer = job.customer_id === userId;

    let query = supabase
      .from('offers')
      .select(`
        *,
        artisan:artisans(
          id,
          profiles(full_name, profile_picture_url),
          profession,
          average_rating,
          total_reviews,
          total_jobs_completed
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    // If not the customer, only show user's own offer
    if (!isCustomer) {
      query = query.eq('artisan_id', userId);
    }

    const { data: offers, error } = await query;

    if (error) {
      throw new Error('Failed to fetch offers');
    }

    return offers || [];
  } catch (error) {
    logger.logError(error, { context: 'getJobOffers' });
    throw error;
  }
}

/**
 * Accept an offer
 * @param {string} offerId 
 * @param {string} customerId 
 * @returns {Promise<Object>}
 */
async function acceptOffer(offerId, customerId) {
  try {
    // Get offer details
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        *,
        job:jobs(id, customer_id, title, status)
      `)
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      throw new NotFoundError('Offer');
    }

    // Verify customer owns the job
    if (offer.job.customer_id !== customerId) {
      throw new ForbiddenError('Only the job owner can accept offers');
    }

    // Verify job is still open
    if (offer.job.status !== JOB_STATUS.POSTED) {
      throw new ValidationError('This job is no longer accepting offers');
    }

    // Verify offer is pending
    if (offer.status !== OFFER_STATUS.PENDING) {
      throw new ValidationError('This offer has already been processed');
    }

    // Accept the offer (trigger will handle rejecting others and updating job)
    const { error: updateError } = await supabaseAdmin
      .from('offers')
      .update({
        status: OFFER_STATUS.ACCEPTED,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    if (updateError) {
      throw new Error('Failed to accept offer');
    }

    // Create conversation between customer and artisan
    const conversation = await chatService.createConversation(
      offer.job_id,
      customerId,
      offer.artisan_id
    );

    // Notify artisan
    await notificationService.sendNotification(
      offer.artisan_id,
      'offer_accepted',
      'Offer Accepted! 🎉',
      `Your offer for "${offer.job.title}" has been accepted`,
      { job_id: offer.job_id, conversation_id: conversation.id }
    );

    logger.info(`Offer accepted: ${offerId}`);

    return {
      message: 'Offer accepted successfully',
      conversation_id: conversation.id,
    };
  } catch (error) {
    logger.logError(error, { context: 'acceptOffer' });
    throw error;
  }
}

/**
 * Update offer (modify before acceptance)
 * @param {string} offerId 
 * @param {string} artisanId 
 * @param {Object} updates 
 * @returns {Promise<Object>}
 */
async function updateOffer(offerId, artisanId, updates) {
  try {
    const { data: offer } = await supabase
      .from('offers')
      .select('artisan_id, status')
      .eq('id', offerId)
      .single();

    if (!offer) {
      throw new NotFoundError('Offer');
    }

    if (offer.artisan_id !== artisanId) {
      throw new ForbiddenError('You can only update your own offers');
    }

    if (offer.status !== OFFER_STATUS.PENDING) {
      throw new ValidationError('Cannot update non-pending offers');
    }

    const { data: updatedOffer, error } = await supabase
      .from('offers')
      .update(updates)
      .eq('id', offerId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update offer');
    }

    logger.info(`Offer updated: ${offerId}`);

    return updatedOffer;
  } catch (error) {
    logger.logError(error, { context: 'updateOffer' });
    throw error;
  }
}

/**
 * Withdraw offer
 * @param {string} offerId 
 * @param {string} artisanId 
 * @returns {Promise<Object>}
 */
async function withdrawOffer(offerId, artisanId) {
  try {
    const { data: offer } = await supabase
      .from('offers')
      .select('artisan_id, status')
      .eq('id', offerId)
      .single();

    if (!offer) {
      throw new NotFoundError('Offer');
    }

    if (offer.artisan_id !== artisanId) {
      throw new ForbiddenError('You can only withdraw your own offers');
    }

    if (offer.status !== OFFER_STATUS.PENDING) {
      throw new ValidationError('Cannot withdraw non-pending offers');
    }

    const { error } = await supabase
      .from('offers')
      .update({ status: OFFER_STATUS.WITHDRAWN })
      .eq('id', offerId);

    if (error) {
      throw new Error('Failed to withdraw offer');
    }

    logger.info(`Offer withdrawn: ${offerId}`);

    return { message: 'Offer withdrawn successfully' };
  } catch (error) {
    logger.logError(error, { context: 'withdrawOffer' });
    throw error;
  }
}

module.exports = {
  createOffer,
  getJobOffers,
  acceptOffer,
  updateOffer,
  withdrawOffer,
};
