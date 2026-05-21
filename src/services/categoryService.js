const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Get all categories
 * @returns {Promise<Array>}
 */
async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch categories');
    }

    return data || [];
  } catch (error) {
    logger.logError(error, { context: 'getCategories' });
    throw error;
  }
}

module.exports = {
  getCategories,
};
