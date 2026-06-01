const { supabase } = require('../config/supabase');
const { calculateDistance } = require('../utils/helpers');
const { GEO } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Location Service
 * 
 * Business logic for geolocation features
 */

/**
 * Update user's live location
 * @param {string} userId 
 * @param {Object} locationData 
 * @returns {Promise<Object>}
 */
async function updateLiveLocation(userId, locationData) {
  try {
    const { latitude, longitude, accuracy } = locationData;

    // Upsert live location
    const { data, error } = await supabase
      .from('user_live_locations')
      .upsert({
        user_id: userId,
        latitude,
        longitude,
        accuracy,
        geography: `POINT(${longitude} ${latitude})`,
        is_online: true,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      logger.error('Location update error:', error);
      throw new Error('Failed to update location');
    }

    logger.debug(`Location updated for user ${userId}`);

    return {
      message: 'Location updated',
      is_online: true,
    };
  } catch (error) {
    logger.logError(error, { context: 'updateLiveLocation' });
    throw error;
  }
}

/**
 * Find nearby artisans
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
async function findNearbyArtisans(latitude, longitude, filters = {}) {
  try {
    const { radius = GEO.DEFAULT_RADIUS_KM, category, limit = 50 } = filters;

    // Query artisans with location
    let query = supabase
      .from('artisan_locations')
      .select(`
        artisan_id,
        latitude,
        longitude,
        city,
        artisan:artisans(
          id,
          profiles!artisans_id_fkey(full_name, profile_picture_url),
          profession,
          average_rating,
          total_reviews,
          approval_status
        )
      `)
      .limit(limit);

    if (category) {
      query = query.eq('artisan.category_id', category);
    }

    const { data: locations, error } = await query;

    if (error) {
      throw new Error('Failed to fetch artisan locations');
    }

    // Filter approved artisans only
    const approvedLocations = (locations || []).filter(
      loc => loc.artisan?.approval_status === 'approved'
    );

    // Calculate distances and filter by radius
    const artisansWithDistance = approvedLocations
      .map(loc => {
        const distance = calculateDistance(
          latitude,
          longitude,
          loc.latitude,
          loc.longitude
        );

        return {
          ...loc.artisan,
          distance_km: distance,
          location: {
            city: loc.city,
            latitude: loc.latitude,
            longitude: loc.longitude,
          },
        };
      })
      .filter(artisan => artisan.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);

    logger.debug(`Found ${artisansWithDistance.length} nearby artisans`);

    return artisansWithDistance;
  } catch (error) {
    logger.logError(error, { context: 'findNearbyArtisans' });
    throw error;
  }
}

/**
 * Calculate distance between two points
 * @param {Object} from 
 * @param {Object} to 
 * @returns {Promise<Object>}
 */
async function calculateDistanceBetweenPoints(from, to) {
  try {
    const { lat: fromLat, lng: fromLng } = from;
    const { lat: toLat, lng: toLng } = to;

    const distanceKm = calculateDistance(fromLat, fromLng, toLat, toLng);
    const distanceMiles = distanceKm * 0.621371;

    return {
      distance_km: distanceKm,
      distance_miles: Math.round(distanceMiles * 10) / 10,
    };
  } catch (error) {
    logger.logError(error, { context: 'calculateDistanceBetweenPoints' });
    throw error;
  }
}

/**
 * Get user's current location
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getUserLocation(userId) {
  try {
    const { data: location, error } = await supabase
      .from('user_live_locations')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !location) {
      return null;
    }

    return location;
  } catch (error) {
    logger.logError(error, { context: 'getUserLocation' });
    return null;
  }
}

/**
 * Mark user as offline
 * @param {string} userId 
 * @returns {Promise<void>}
 */
async function markUserOffline(userId) {
  try {
    await supabase
      .from('user_live_locations')
      .update({ is_online: false })
      .eq('user_id', userId);

    logger.debug(`User marked offline: ${userId}`);
  } catch (error) {
    logger.logError(error, { context: 'markUserOffline' });
  }
}

module.exports = {
  updateLiveLocation,
  findNearbyArtisans,
  calculateDistanceBetweenPoints,
  getUserLocation,
  markUserOffline,
};
