const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

/**
 * Supabase Client Setup
 * 
 * We create TWO clients:
 * 1. Public client (with anon key) - for user-facing operations with RLS
 * 2. Service client (with service key) - for admin operations bypassing RLS
 */

// Validate Supabase configuration
if (!config.supabase?.url || !config.supabase?.anonKey || !config.supabase?.serviceKey) {
  throw new Error(
    'Missing required Supabase configuration. Please check your .env file and ensure ' +
    'SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY are set.'
  );
}

// Public client - respects Row Level Security (RLS)
const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We handle sessions ourselves with JWT
    },
  }
);

// Service client - bypasses RLS for admin operations
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Helper function to create authenticated client for a specific user
 * @param {string} accessToken - User's JWT token
 * @returns {Object} Supabase client with user context
 */
function createAuthenticatedClient(accessToken) {
  return createClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
      },
    }
  );
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) throw error;

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
}

module.exports = {
  supabase,
  supabaseAdmin,
  createAuthenticatedClient,
  testConnection,
};
