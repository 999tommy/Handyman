const { supabase } = require('../config/supabase');
const { NotFoundError } = require('../middleware/errorHandler');
const { calculateDistance, paginate, createPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * User Service
 * 
 * Business logic for user and artisan profile management
 */

/**
 * Get user profile
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new NotFoundError('User profile');
    }

    // Get role-specific data
    let roleData = null;
    if (profile.role === 'customer') {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', userId)
        .single();
      roleData = data;
    } else if (profile.role === 'artisan') {
      const { data } = await supabase
        .from('artisans')
        .select(`
          *,
          category:categories(name),
          location:artisan_locations(*)
        `)
        .eq('id', userId)
        .single();
      roleData = data;
    }

    return {
      ...profile,
      role_data: roleData,
    };
  } catch (error) {
    logger.logError(error, { context: 'getUserProfile' });
    throw error;
  }
}

/**
 * Update user profile
 * @param {string} userId 
 * @param {Object} updates 
 * @returns {Promise<Object>}
 */
async function updateUserProfile(userId, updates) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update profile');
    }

    logger.info(`Profile updated: ${userId}`);

    return await getUserProfile(userId);
  } catch (error) {
    logger.logError(error, { context: 'updateUserProfile' });
    throw error;
  }
}

/**
 * Get artisan public profile
 * @param {string} artisanId 
 * @returns {Promise<Object>}
 */
async function getArtisanProfile(artisanId) {
  try {
    const { data: artisan, error } = await supabase
      .from('artisans')
      .select(`
        *,
        profile:profiles(full_name, profile_picture_url, created_at),
        category:categories(id, name, icon_url),
        location:artisan_locations(*),
        availability:artisan_availability(*),
        portfolio:artisan_portfolio(*)
      `)
      .eq('id', artisanId)
      .single();

    if (error || !artisan) {
      throw new NotFoundError('Artisan');
    }

    return artisan;
  } catch (error) {
    logger.logError(error, { context: 'getArtisanProfile' });
    throw error;
  }
}

/**
 * Search artisans
 * @param {Object} filters 
 * @returns {Promise<Object>}
 */
async function searchArtisans(filters = {}) {
  try {
    const {
      category,
      city,
      lat,
      lng,
      radius = 25,
      sort = 'rating',
      page = 1,
      limit = 20,
    } = filters;

    const { offset, limit: validLimit } = paginate(page, limit);

    let query = supabase
      .from('artisans')
      .select(`
        id,
        profession,
        tagline,
        average_rating,
        total_reviews,
        total_jobs_completed,
        base_rate,
        profile:profiles(full_name, profile_picture_url),
        location:artisan_locations(city, latitude, longitude)
      `, { count: 'exact' })
      .eq('approval_status', 'approved');

    if (category) {
      query = query.eq('category_id', category);
    }

    const { data: artisans, error, count } = await query;

    if (error) {
      throw new Error('Failed to search artisans');
    }

    // Filter by location if provided
    let filteredArtisans = artisans;
    if (lat && lng && artisans) {
      filteredArtisans = artisans
        .map(artisan => {
          if (artisan.location?.[0]) {
            const loc = artisan.location[0];
            const distance = calculateDistance(lat, lng, loc.latitude, loc.longitude);
            return {
              ...artisan,
              distance_km: distance,
            };
          }
          return artisan;
        })
        .filter(artisan => !radius || artisan.distance_km <= radius);
    }

    // Filter by city if provided
    if (city) {
      filteredArtisans = filteredArtisans.filter(artisan =>
        artisan.location?.[0]?.city?.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Sort
    if (sort === 'rating') {
      filteredArtisans.sort((a, b) => b.average_rating - a.average_rating);
    } else if (sort === 'distance' && lat && lng) {
      filteredArtisans.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
    } else if (sort === 'reviews') {
      filteredArtisans.sort((a, b) => b.total_reviews - a.total_reviews);
    } else if (sort === 'price') {
      filteredArtisans.sort((a, b) => a.base_rate - b.base_rate);
    }

    // Paginate
    const paginatedResults = filteredArtisans.slice(offset, offset + validLimit);

    return {
      artisans: paginatedResults,
      pagination: createPaginationMeta(filteredArtisans.length, page, validLimit),
    };
  } catch (error) {
    logger.logError(error, { context: 'searchArtisans' });
    throw error;
  }
}

/**
 * Update artisan profile
 * @param {string} artisanId 
 * @param {Object} updates 
 * @returns {Promise<Object>}
 */
async function updateArtisanProfile(artisanId, updates) {
  try {
    const { error } = await supabase
      .from('artisans')
      .update(updates)
      .eq('id', artisanId);

    if (error) {
      throw new Error('Failed to update artisan profile');
    }

    logger.info(`Artisan profile updated: ${artisanId}`);

    return await getArtisanProfile(artisanId);
  } catch (error) {
    logger.logError(error, { context: 'updateArtisanProfile' });
    throw error;
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  getArtisanProfile,
  searchArtisans,
  updateArtisanProfile,
};
