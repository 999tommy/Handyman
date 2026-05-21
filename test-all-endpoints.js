require('dotenv').config({ path: '.env.local' });
const request = require('supertest');
const app = require('./src/app');

async function testAll() {
  console.log('--- TESTING ENDPOINTS ---');
  
  // 1. Login Customer
  const customerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test.customer@test.com', password: 'TestPass123!' });
  console.log('Customer Login:', customerLogin.status, customerLogin.body.error || 'Success');
  
  const customerToken = customerLogin.body?.data?.session?.access_token;

  // 2. Login Artisan
  const artisanLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test.artisan@test.com', password: 'TestPass123!' });
  console.log('Artisan Login:', artisanLogin.status, artisanLogin.body.error || 'Success');
  
  const artisanToken = artisanLogin.body?.data?.session?.access_token;

  // 3. Test Category endpoint (maybe it doesn't exist?)
  const categoriesRes = await request(app).get('/api/categories');
  console.log('Categories Endpoint (/api/categories):', categoriesRes.status, categoriesRes.body);

  // 4. Test Get Jobs (Customer)
  if (customerToken) {
    const myJobsRes = await request(app)
      .get('/api/jobs/my-jobs')
      .set('Authorization', `Bearer ${customerToken}`);
    console.log('My Jobs (Customer):', myJobsRes.status, myJobsRes.body.error || 'Success');
  }

  // 5. Test Browse Jobs (Artisan)
  if (artisanToken) {
    const browseJobsRes = await request(app)
      .get('/api/jobs/browse')
      .set('Authorization', `Bearer ${artisanToken}`);
    console.log('Browse Jobs (Artisan):', browseJobsRes.status, browseJobsRes.body.error || 'Success');
  }

  // 6. Test Conversations (Customer)
  if (customerToken) {
    const convRes = await request(app)
      .get('/api/chat/conversations')
      .set('Authorization', `Bearer ${customerToken}`);
    console.log('Conversations (Customer):', convRes.status, convRes.body.error || 'Success');
  }
}

testAll()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
