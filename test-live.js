const axios = require('axios');

async function testLive() {
  const email = `test.cust.${Math.floor(Math.random() * 1000000)}@test.com`;
  const phone = `0803${Math.floor(1000000 + Math.random() * 9000000)}`;
  
  const payload = {
    first_name: "Test",
    last_name: "Customer",
    email: email,
    password: "TestPass123!",
    phone_number: phone,
    address: "No 3, Rajui Road, Lagos",
    interested_services: ["Plumbing", "Electrical"]
  };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post('https://handyman-1-drwc.onrender.com/api/auth/register/customer', payload);
    console.log('Status Code:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('Error occurred!');
    if (err.response) {
      console.log('Status Code:', err.response.status);
      console.log('Response:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.log('Message:', err.message);
    }
  }
}

testLive();
