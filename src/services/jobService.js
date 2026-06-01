const { supabase, supabaseAdmin } = require('../config/supabase');
const { NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');
const { JOB_STATUS } = require('../utils/constants');
const { paginate, createPaginationMeta, isDateInPast } = require('../utils/helpers');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

/**
 * Job Service
 * 
 * Business logic for job management
 */

/**
 * Create a new job
 * @param {string} customerId 
 * @param {Object} jobData 
 * @returns {Promise<Object>}
 */
async function createJob(customerId, jobData) {
  try {
    const {
      category_id,
      title,
      description,
      budget,
      date_preference,
      preferred_date,
      deadline_date,
      time_preference,
      needs_specific_time,
      service_type,
      street,
      city,
      latitude,
      longitude,
      photos,
    } = jobData;

    // Validate date
    if (preferred_date && isDateInPast(preferred_date)) {
      throw new ValidationError('Preferred date cannot be in the past');
    }

    // Create job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        customer_id: customerId,
        category_id,
        title,
        description,
        budget,
        date_preference,
        preferred_date,
        deadline_date,
        time_preference,
        needs_specific_time,
        service_type,
        street,
        city,
        latitude,
        longitude,
        geography: latitude && longitude ? `POINT(${longitude} ${latitude})` : null,
        status: JOB_STATUS.POSTED,
      })
      .select()
      .single();

    if (error) {
      logger.error('Job creation error:', error);
      throw new Error('Failed to create job');
    }

    // Insert job photos if provided
    if (photos && photos.length > 0) {
      const photoRecords = photos.map((url, index) => ({
        job_id: job.id,
        photo_url: url,
        upload_order: index,
      }));

      await supabase.from('job_photos').insert(photoRecords);
    }

    // Notify nearby artisans in the same category
    await notificationService.notifyNearbyArtisans(job);

    logger.info(`Job created: ${job.id} by customer ${customerId}`);

    return job;
  } catch (error) {
    logger.logError(error, { context: 'createJob' });
    throw error;
  }
}

/**
 * Get job by ID
 * @param {string} jobId 
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>}
 */
async function getJobById(jobId, userId = null) {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(
          id,
          profiles!customers_id_fkey(full_name, profile_picture_url)
        ),
        category:categories(id, name, icon_url),
        photos:job_photos(id, photo_url, upload_order),
        assigned_artisan:artisans(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
          profession,
          average_rating
        )
      `)
      .eq('id', jobId)
      .single();

    if (error || !job) {
      throw new NotFoundError('Job');
    }

    // Check access permissions
    // Customers can only see their own jobs unless it's posted
    // Artisans can see all posted jobs
    if (userId) {
      const isOwner = job.customer_id === userId;
      const isAssignedArtisan = job.assigned_artisan_id === userId;
      const isPosted = job.status === JOB_STATUS.POSTED;

      if (!isOwner && !isAssignedArtisan && !isPosted) {
        throw new ForbiddenError('You do not have access to this job');
      }
    }

    return job;
  } catch (error) {
    logger.logError(error, { context: 'getJobById' });
    throw error;
  }
}

/**
 * Get customer's jobs
 * @param {string} customerId 
 * @param {Object} filters 
 * @returns {Promise<Object>}
 */
async function getCustomerJobs(customerId, filters = {}) {
  try {
    const { page = 1, limit = 20, status } = filters;
    const { offset, limit: validLimit } = paginate(page, limit);

    let query = supabase
      .from('jobs')
      .select(`
        *,
        category:categories(name),
        photos:job_photos(photo_url),
        assigned_artisan:artisans(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
          profession
        )
      `, { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error, count } = await query
      .range(offset, offset + validLimit - 1);

    if (error) {
      throw new Error('Failed to fetch jobs');
    }

    return {
      jobs: jobs || [],
      pagination: createPaginationMeta(count, page, validLimit),
    };
  } catch (error) {
    logger.logError(error, { context: 'getCustomerJobs' });
    throw error;
  }
}

/**
 * Browse jobs (for artisans)
 * @param {string} artisanId 
 * @param {Object} filters 
 * @returns {Promise<Object>}
 */
async function browseJobs(artisanId, filters = {}) {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      city,
      max_distance,
      min_budget,
      max_budget,
      date_from,
      date_to,
      sort = 'date',
    } = filters;

    const { offset, limit: validLimit } = paginate(page, limit);

    // Get artisan's location for distance calculation
    let artisanLocation = null;
    if (max_distance) {
      const { data: location } = await supabase
        .from('artisan_locations')
        .select('latitude, longitude')
        .eq('artisan_id', artisanId)
        .single();

      artisanLocation = location;
    }

    let query = supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(
          profiles!customers_id_fkey(full_name)
        ),
        category:categories(name),
        photos:job_photos(photo_url)
      `, { count: 'exact' })
      .eq('status', JOB_STATUS.POSTED);

    if (category) {
      query = query.eq('category_id', category);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    if (min_budget) {
      query = query.gte('budget', min_budget);
    }

    if (max_budget) {
      query = query.lte('budget', max_budget);
    }

    if (date_from) {
      query = query.gte('preferred_date', date_from);
    }

    if (date_to) {
      query = query.lte('preferred_date', date_to);
    }

    // Sorting
    if (sort === 'budget') {
      query = query.order('budget', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: jobs, error, count } = await query
      .range(offset, offset + validLimit - 1);

    if (error) {
      throw new Error('Failed to browse jobs');
    }

    // Calculate distance if location filtering is enabled
    if (artisanLocation && jobs) {
      const { calculateDistance } = require('../utils/helpers');
      
      jobs.forEach(job => {
        if (job.latitude && job.longitude) {
          job.distance_km = calculateDistance(
            artisanLocation.latitude,
            artisanLocation.longitude,
            job.latitude,
            job.longitude
          );
        }
      });

      // Filter by max distance
      const filteredJobs = max_distance
        ? jobs.filter(job => job.distance_km <= max_distance)
        : jobs;

      return {
        jobs: filteredJobs,
        pagination: createPaginationMeta(filteredJobs.length, page, validLimit),
      };
    }

    return {
      jobs: jobs || [],
      pagination: createPaginationMeta(count, page, validLimit),
    };
  } catch (error) {
    logger.logError(error, { context: 'browseJobs' });
    throw error;
  }
}

/**
 * Update job
 * @param {string} jobId 
 * @param {string} customerId 
 * @param {Object} updates 
 * @returns {Promise<Object>}
 */
async function updateJob(jobId, customerId, updates) {
  try {
    // Get job to verify ownership
    const { data: job } = await supabase
      .from('jobs')
      .select('customer_id, status')
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new NotFoundError('Job');
    }

    if (job.customer_id !== customerId) {
      throw new ForbiddenError('You can only update your own jobs');
    }

    // Can't update completed/cancelled jobs
    if ([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED].includes(job.status)) {
      throw new ValidationError('Cannot update completed or cancelled jobs');
    }

    // Update job
    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update job in database:', error);
      throw new Error('Failed to update job');
    }

    logger.info(`Job updated: ${jobId}`);

    return updatedJob;
  } catch (error) {
    logger.logError(error, { context: 'updateJob' });
    throw error;
  }
}

/**
 * Cancel job
 * @param {string} jobId 
 * @param {string} customerId 
 * @param {string} reason 
 * @returns {Promise<Object>}
 */
async function cancelJob(jobId, customerId, reason = null) {
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new NotFoundError('Job');
    }

    if (job.customer_id !== customerId) {
      throw new ForbiddenError('You can only cancel your own jobs');
    }

    if (job.status === JOB_STATUS.COMPLETED) {
      throw new ValidationError('Cannot cancel completed jobs');
    }

    // Update job status
    const { error } = await supabase
      .from('jobs')
      .update({ status: JOB_STATUS.CANCELLED })
      .eq('id', jobId);

    if (error) {
      throw new Error('Failed to cancel job');
    }

    // If job was assigned, notify artisan
    if (job.assigned_artisan_id) {
      await notificationService.sendNotification(
        job.assigned_artisan_id,
        'job_cancelled',
        'Job Cancelled',
        `The job "${job.title}" has been cancelled by the customer`,
        { job_id: jobId }
      );
    }

    // Handle payment refund if payment was held
    // TODO: Implement payment refund logic

    logger.info(`Job cancelled: ${jobId}`);

    return { message: 'Job cancelled successfully' };
  } catch (error) {
    logger.logError(error, { context: 'cancelJob' });
    throw error;
  }
}

module.exports = {
  createJob,
  getJobById,
  getCustomerJobs,
  browseJobs,
  updateJob,
  cancelJob,
};
