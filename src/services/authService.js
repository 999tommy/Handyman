const { supabase, supabaseAdmin } = require('../config/supabase');
const { ConflictError, UnauthorizedError, ValidationError } = require('../middleware/errorHandler');
const { USER_ROLES } = require('../utils/constants');
const { generateVerificationCode, formatPhoneToInternational } = require('../utils/helpers');
const logger = require('../utils/logger');
const smsService = require('./smsService');

/**
 * Authentication Service
 * 
 * Business logic for user authentication
 * This is the separation of concerns pattern:
 * - Controllers handle HTTP (req/res)
 * - Services handle business logic
 * - This is similar to Next.js server actions or API route logic
 */

/**
 * Register a new customer
 * @param {Object} userData - Customer registration data
 * @returns {Promise<Object>} User and session data
 */
async function registerCustomer(userData) {
  const { email, password, full_name, phone_number } = userData;

  try {
    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create auth user in Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for now
    });

    if (authError) {
      logger.error('Supabase auth error:', authError);
      throw new Error(authError.message);
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        role: USER_ROLES.CUSTOMER,
        full_name,
        phone_number: formatPhoneToInternational(phone_number),
        phone_verified: false,
      });

    if (profileError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to create profile');
    }

    // Create customer record
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({ id: userId });

    if (customerError) {
      throw new Error('Failed to create customer record');
    }

    // Send verification code
    await sendPhoneVerificationCode(phone_number);

    // Generate session
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      throw new Error('Failed to create session');
    }

    logger.info(`Customer registered: ${userId}`);

    return {
      user: {
        id: userId,
        email,
        role: USER_ROLES.CUSTOMER,
      },
      session: sessionData.session,
    };
  } catch (error) {
    logger.logError(error, { context: 'registerCustomer' });
    throw error;
  }
}

/**
 * Register a new artisan (multi-step with admin approval)
 * @param {Object} artisanData - Complete artisan registration data
 * @returns {Promise<Object>} Artisan data pending approval
 */
async function registerArtisan(artisanData) {
  const {
    email,
    password,
    full_name,
    phone_number,
    profession,
    category_id,
    tagline,
    years_experience,
    description,
    skills,
    base_rate,
    government_id_url,
    profile_picture_url,
    bank_name,
    account_number,
    account_name,
    workstation_address,
    city,
    latitude,
    longitude,
    availability,
    portfolio_images,
  } = artisanData;

  try {
    // Check if email exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        role: USER_ROLES.ARTISAN,
        full_name,
        phone_number: formatPhoneToInternational(phone_number),
        phone_verified: false,
        profile_picture_url,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to create profile');
    }

    // Create artisan record
    const { error: artisanError } = await supabaseAdmin
      .from('artisans')
      .insert({
        id: userId,
        profession,
        category_id,
        tagline,
        years_experience,
        description,
        skills,
        base_rate,
        government_id_url,
        bank_name,
        account_number,
        account_name,
        verification_status: 'pending',
        approval_status: 'pending',
      });

    if (artisanError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to create artisan profile');
    }

    // Create artisan location
    const { error: locationError } = await supabaseAdmin
      .from('artisan_locations')
      .insert({
        artisan_id: userId,
        workstation_address,
        city,
        latitude,
        longitude,
        street: workstation_address,
        geography: `POINT(${longitude} ${latitude})`,
      });

    if (locationError) {
      logger.error('Location insert error:', locationError);
    }

    // Insert availability schedule
    if (availability && availability.length > 0) {
      const availabilityRecords = availability.map(slot => ({
        artisan_id: userId,
        ...slot,
      }));

      const { error: availError } = await supabaseAdmin
        .from('artisan_availability')
        .insert(availabilityRecords);

      if (availError) {
        logger.error('Availability insert error:', availError);
      }
    }

    // Insert portfolio images
    if (portfolio_images && portfolio_images.length > 0) {
      const portfolioRecords = portfolio_images.map((url, index) => ({
        artisan_id: userId,
        image_url: url,
        upload_order: index,
      }));

      const { error: portfolioError } = await supabaseAdmin
        .from('artisan_portfolio')
        .insert(portfolioRecords);

      if (portfolioError) {
        logger.error('Portfolio insert error:', portfolioError);
      }
    }

    // Send verification code
    await sendPhoneVerificationCode(phone_number);

    logger.info(`Artisan registered (pending approval): ${userId}`);

    return {
      message: 'Registration successful. Awaiting admin approval.',
      artisan: {
        id: userId,
        email,
        approval_status: 'pending',
      },
    };
  } catch (error) {
    logger.logError(error, { context: 'registerArtisan' });
    throw error;
  }
}

/**
 * Login user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} User and session
 */
async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Fetch full profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    logger.info(`User logged in: ${data.user.id}`);

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.role,
        profile,
      },
      session: data.session,
    };
  } catch (error) {
    logger.logError(error, { context: 'login' });
    throw error;
  }
}

/**
 * Send phone verification code
 * @param {string} phoneNumber 
 * @returns {Promise<void>}
 */
async function sendPhoneVerificationCode(phoneNumber) {
  try {
    const formattedPhone = formatPhoneToInternational(phoneNumber);
    const code = generateVerificationCode(6);

    // Store verification code in database (with expiry)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // You'd want a verification_codes table for this
    // For now, we'll use a simple approach with session storage
    
    // Send SMS
    await smsService.sendSMS(formattedPhone, `Your Handyman verification code is: ${code}`);

    logger.info(`Verification code sent to ${formattedPhone}`);

    // In production, store the code in database or Redis with expiry
    // For now, return the code (ONLY in development)
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`DEV: Verification code for ${formattedPhone}: ${code}`);
    }

    return { message: 'Verification code sent' };
  } catch (error) {
    logger.logError(error, { context: 'sendPhoneVerificationCode' });
    throw new Error('Failed to send verification code');
  }
}

/**
 * Verify phone number
 * @param {string} userId 
 * @param {string} phoneNumber 
 * @param {string} code 
 * @returns {Promise<Object>}
 */
async function verifyPhone(userId, phoneNumber, code) {
  try {
    // In production, verify code from database/Redis
    // For now, we'll use a simple check
    
    // TODO: Implement proper code verification
    
    // Update profile
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ phone_verified: true })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update phone verification status');
    }

    logger.info(`Phone verified for user: ${userId}`);

    return {
      message: 'Phone verified successfully',
      phone_verified: true,
    };
  } catch (error) {
    logger.logError(error, { context: 'verifyPhone' });
    throw error;
  }
}

/**
 * Refresh access token
 * @param {string} refreshToken 
 * @returns {Promise<Object>}
 */
async function refreshAccessToken(refreshToken) {
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return {
      session: data.session,
    };
  } catch (error) {
    logger.logError(error, { context: 'refreshAccessToken' });
    throw error;
  }
}

module.exports = {
  registerCustomer,
  registerArtisan,
  login,
  sendPhoneVerificationCode,
  verifyPhone,
  refreshAccessToken,
};
