const { supabase, supabaseAdmin, supabaseAnon } = require('../config/supabase');
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
  const { email, password, first_name, last_name, phone_number, address, interested_services } = userData;

  // Combine first and last name
  const full_name = `${first_name} ${last_name}`;
  const normalizedPhone = formatPhoneToInternational(phone_number);

  try {
    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Check if phone number already exists
    const { data: existingPhone } = await supabaseAdmin
      .from('profiles')
      .select('phone_number')
      .eq('phone_number', normalizedPhone)
      .maybeSingle();

    if (existingPhone) {
      throw new ConflictError('Phone number already registered');
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

    // Create profile with address and interested services
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        role: USER_ROLES.CUSTOMER,
        full_name,
        phone_number: normalizedPhone,
        phone_verified: false,
        address, // Plain text address
        interested_services, // Array of service categories
      });

    if (profileError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      logger.error('Profile creation error:', profileError);
      if (profileError.code === '23505') {
        const errorMessage = profileError.message || '';
        if (errorMessage.includes('profiles_phone_number_key')) {
          throw new ConflictError('Phone number already registered');
        }
        if (errorMessage.includes('profiles_pkey') || errorMessage.includes('profiles_id_key')) {
          throw new ConflictError('Profile already exists');
        }
      }

      throw new Error('Failed to create profile');
    }

    // Create customer record
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({ id: userId });

    if (customerError) {
      logger.error('Customer record error:', customerError);
      throw new Error('Failed to create customer record');
    }

    // NO SMS verification for customers

    // Generate session
    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
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
    category_name,
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

    // Resolve category ID if provided by name
    let resolvedCategoryId = category_id || null;

    if (!resolvedCategoryId && category_name) {
      const normalizedCategoryName = category_name.trim();
      const { data: categoryRecord, error: categoryLookupError } = await supabaseAdmin
        .from('categories')
        .select('id')
        .ilike('name', normalizedCategoryName)
        .maybeSingle();

      if (categoryLookupError) {
        logger.error('Category lookup error:', categoryLookupError);
        throw new Error('Failed to resolve category');
      }

      if (!categoryRecord) {
        throw new ValidationError(`Unknown category: ${normalizedCategoryName}`);
      }

      resolvedCategoryId = categoryRecord.id;
    }

    if (!resolvedCategoryId) {
      throw new ValidationError('Category is required');
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
        phone_verified: true, // Auto-verify to bypass OTP requirement
        profile_picture_url,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to create profile');
    }

    // Create artisan record (AUTO-APPROVED)
    const { error: artisanError } = await supabaseAdmin
      .from('artisans')
      .insert({
        id: userId,
        profession,
        category_id: resolvedCategoryId,
        tagline,
        years_experience,
        description,
        skills,
        base_rate,
        government_id_url,
        bank_name,
        account_number,
        account_name,
        verification_status: 'verified', // Auto-verified since they completed all steps
        approval_status: 'approved', // Auto-approved - no admin approval needed
      });

    if (artisanError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      logger.error('Artisan record error:', artisanError);

      if (artisanError.code === '23505') {
        const message = artisanError.message || '';
        if (message.includes('artisans_pkey') || message.includes('artisans_id_key')) {
          throw new ConflictError('Artisan profile already exists');
        }
      }

      if (artisanError.code === '23502' && artisanError.details) {
        throw new ValidationError(`Missing required artisan field: ${artisanError.details}`);
      }

      if (artisanError.message) {
        throw new ValidationError(artisanError.message);
      }

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

    // NO SMS verification here - artisan already verified during onboarding
    // They can now login immediately

    // Generate session for auto-login
    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      logger.error('Session creation error:', sessionError);
      throw new Error('Failed to create session');
    }

    logger.info(`Artisan registered and auto-approved: ${userId}`);

    return {
      message: 'Registration successful! You can now start browsing jobs.',
      user: {
        id: userId,
        email,
        role: USER_ROLES.ARTISAN,
        approval_status: 'approved',
      },
      session: sessionData.session,
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
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
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

    // Store code in profiles table temporarily (or create a verification_codes table)
    // For simplicity, we'll use a JSONB field or create a separate table
    // Using upsert to handle multiple verification attempts
    const { error: storeError } = await supabaseAdmin
      .from('phone_verifications')
      .upsert({
        phone_number: formattedPhone,
        code: code,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      }, { onConflict: 'phone_number' });

    if (storeError) {
      logger.error('Failed to store verification code:', storeError);
      // Continue anyway - we can still send the SMS
    }
    
    // Send SMS via Twilio
    await smsService.sendSMS(formattedPhone, `Your Handyman verification code is: ${code}`);

    logger.info(`Verification code sent to ${formattedPhone}`);

    // In development, log the code for testing
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`DEV: Verification code for ${formattedPhone}: ${code}`);
    }

    return { 
      message: 'Verification code sent',
      // Return code in development for easy testing
      ...(process.env.NODE_ENV === 'development' && { code })
    };
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
async function verifyPhone(phoneNumber, code) {
  try {
    const formattedPhone = formatPhoneToInternational(phoneNumber);

    // Get verification record from database
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from('phone_verifications')
      .select('*')
      .eq('phone_number', formattedPhone)
      .single();

    if (fetchError || !verification) {
      throw new ValidationError('No verification code found for this number');
    }

    // Check if code is expired
    if (new Date(verification.expires_at) < new Date()) {
      throw new ValidationError('Verification code has expired. Please request a new one.');
    }

    // Check if too many attempts
    if (verification.attempts >= 5) {
      throw new ValidationError('Too many verification attempts. Please request a new code.');
    }

    // Verify the code
    if (verification.code !== code) {
      // Increment attempts
      await supabaseAdmin
        .from('phone_verifications')
        .update({ attempts: verification.attempts + 1 })
        .eq('phone_number', formattedPhone);

      throw new ValidationError('Invalid verification code');
    }

    // Code is valid - mark phone as verified
    // Find user by phone number and update
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ phone_verified: true })
      .eq('phone_number', formattedPhone);

    if (updateError) {
      logger.error('Failed to update phone verification:', updateError);
    }

    // Delete verification record (cleanup)
    await supabaseAdmin
      .from('phone_verifications')
      .delete()
      .eq('phone_number', formattedPhone);

    logger.info(`Phone verified: ${formattedPhone}`);

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
    const { data, error } = await supabaseAnon.auth.refreshSession({
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
