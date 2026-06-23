const axios = require('axios');

const BASE_URL = 'https://handyman-1-drwc.onrender.com';

async function testArtisanRegistration() {
  const timestamp = Date.now();
  const email = `artisan.test.${timestamp}@test.com`;
  const phone = `0803${Math.floor(1000000 + Math.random() * 9000000)}`;

  // Payload mirroring what frontend dev would send (based on the error context)
  const payload = {
    full_name: "Test Artisan",
    email: email,
    password: "TestPass123!",
    phone_number: phone,
    // Use category_name since we don't know the UUID
    category_name: "Plumbing",
    profession: "Plumber",
    tagline: "Professional plumber with 5 years experience",
    years_experience: 5,
    description: "I am a skilled plumber with over 5 years of experience handling residential and commercial plumbing jobs. I provide quality service at affordable rates.",
    skills: ["Pipe Fitting", "Leak Repair", "Drainage Systems"],
    base_rate: 5000,
    profile_picture_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    government_id_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    portfolio_images: [
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample.jpg"
    ],
    workstation_address: "No 5, Adeola Odeku Street, Victoria Island, Lagos",
    city: "Lagos",
    latitude: 6.4281,
    longitude: 3.4219,
    availability: [
      { day_of_week: 1, start_time: "08:00", end_time: "17:00" },
      { day_of_week: 2, start_time: "08:00", end_time: "17:00" },
      { day_of_week: 3, start_time: "08:00", end_time: "17:00" },
    ],
    bank_name: "First Bank",
    account_number: "1234567890",
    account_name: "Test Artisan",
  };

  console.log('\n=== ARTISAN REGISTRATION TEST ===');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('\nSending request...\n');

  try {
    const res = await axios.post(`${BASE_URL}/api/auth/register/artisan`, payload, {
      timeout: 30000,
    });
    console.log('✅ SUCCESS');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('❌ FAILED');
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Response:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.log('Network Error:', err.message);
    }
  }
}

testArtisanRegistration();
