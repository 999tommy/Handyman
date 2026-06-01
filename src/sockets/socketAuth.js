const { supabase, supabaseAnon, createAuthenticatedClient } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Socket.io Authentication Middleware
 * 
 * Verifies JWT token before allowing Socket connection
 */

async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Invalid or expired token'));
    }

    // Fetch user profile
    const userSupabase = createAuthenticatedClient(token);
    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return next(new Error('User profile not found'));
    }

    // Attach user data to socket
    socket.userId = user.id;
    socket.userRole = profile.role;
    socket.userData = profile;

    logger.debug(`Socket authenticated: ${user.id}`);
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
}

module.exports = socketAuthMiddleware;
