require('dotenv').config({ path: '.env.local' });
const authService = require('./src/services/authService');
const { supabaseAdmin } = require('./src/config/supabase');

const CUSTOMER_DATA = {
  email: 'test.customer@test.com',
  password: 'TestPass123!',
  first_name: 'Test',
  last_name: 'Customer',
  phone_number: '+2348012345678',
  address: 'No 3, Rajui Road Lagos Nigeria',
  interested_services: ['Plumbing', 'Electrical']
};

const ARTISAN_DATA = {
  email: 'test.artisan@test.com',
  password: 'TestPass123!',
  full_name: 'Test Artisan',
  phone_number: '+2348012345679',
  category_name: 'Plumbing',
  profession: 'Plumber',
  tagline: 'Expert plumber with 10 years experience',
  years_experience: 10,
  description: 'Professional plumbing services across Lagos.',
  skills: ['pipe installation', 'leak repair'],
  base_rate: 5000,
  government_id_url: 'https://example.com/id.jpg',
  profile_picture_url: 'https://example.com/profile.jpg',
  bank_name: 'GTBank',
  account_number: '0123456789',
  account_name: 'Test Artisan',
  workstation_address: '123 Main St, Ikeja',
  city: 'Lagos',
  latitude: 6.5244,
  longitude: 3.3792,
  availability: [
    { day_of_week: 1, start_time: '09:00', end_time: '17:00' }
  ],
  portfolio_images: [
    'https://example.com/work-1.jpg'
  ]
};

async function getOrCreateTokens() {
  console.log('--- Generating Auth Tokens ---');

  let customerToken = null;
  let artisanToken = null;

  // 1. Customer
  try {
    console.log('Logging in customer...');
    const result = await authService.login(CUSTOMER_DATA.email, CUSTOMER_DATA.password);
    customerToken = result.session.access_token;
    console.log('Customer logged in successfully!');
  } catch (error) {
    if (error.message.includes('Invalid email or password') || error.status === 401) {
      console.log('Customer does not exist. Registering customer...');
      try {
        const result = await authService.registerCustomer(CUSTOMER_DATA);
        customerToken = result.session.access_token;
        console.log('Customer registered successfully!');
      } catch (regError) {
        console.error('Failed to register customer:', regError.message);
      }
    } else {
      console.error('Customer login error:', error.message);
    }
  }

  // 2. Artisan
  try {
    console.log('Logging in artisan...');
    const result = await authService.login(ARTISAN_DATA.email, ARTISAN_DATA.password);
    artisanToken = result.session.access_token;
    console.log('Artisan logged in successfully!');
  } catch (error) {
    if (error.message.includes('Invalid email or password') || error.status === 401) {
      console.log('Artisan does not exist. Registering artisan...');
      try {
        const result = await authService.registerArtisan(ARTISAN_DATA);
        artisanToken = result.session.access_token;
        console.log('Artisan registered successfully!');
      } catch (regError) {
        console.error('Failed to register artisan:', regError.message);
      }
    } else {
      console.error('Artisan login error:', error.message);
    }
  }

  console.log('\n==================================================');
  console.log('CUSTOMER BEARER TOKEN:');
  console.log(customerToken || 'FAILED TO GENERATE');
  console.log('==================================================');
  console.log('ARTISAN BEARER TOKEN:');
  console.log(artisanToken || 'FAILED TO GENERATE');
  console.log('==================================================\n');
}

getOrCreateTokens()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
