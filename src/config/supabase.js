const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// Validate Supabase configuration
if (!config.supabase?.url || !config.supabase?.anonKey || !config.supabase?.serviceKey) {
  throw new Error(
    'Missing required Supabase configuration. Please check your .env file and ensure ' +
    'SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY are set.'
  );
}

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

// Anonymous client - for user authentication, signIn, etc.
const supabaseAnon = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// In a secure Express backend server, we use the admin client context 
// to bypass RLS rejections since security is fully managed by Express middlewares.
const supabase = supabaseAdmin;

// Helper function to create authenticated client for a specific user if needed
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
    const { data, error } = await supabaseAdmin
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
  supabaseAnon,
  createAuthenticatedClient,
  testConnection,
};
