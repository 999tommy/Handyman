require('dotenv').config({ path: '.env.local' });
const request = require('supertest');
const app = require('./src/app');

async function testOtp() {
  const phone = '+2348012345678';
  
  console.log(`Sending verification code to ${phone}...`);
  const sendRes = await request(app)
    .post('/api/auth/send-verification-code')
    .send({ phone_number: phone });
    
  console.log('Send Response Status:', sendRes.status);
  console.log('Send Response Body:', JSON.stringify(sendRes.body, null, 2));
  
  if (sendRes.status !== 200) {
    console.error('Failed to send OTP. Aborting.');
    return;
  }
  
  // We hardcoded the verification code to 666666
  const code = '666666';
  
  console.log(`Verifying code ${code} for ${phone}...`);
  const verifyRes = await request(app)
    .post('/api/auth/verify-phone')
    .send({ phone_number: phone, code: code });
    
  console.log('Verify Response Status:', verifyRes.status);
  console.log('Verify Response Body:', JSON.stringify(verifyRes.body, null, 2));
}

testOtp().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
