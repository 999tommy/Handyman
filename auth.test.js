const request = require('supertest');
const app = require('./src/app');

describe('POST /api/auth/register/customer', () => {
  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/auth/register/customer')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
    console.log('Validation error details:', JSON.stringify(response.body.error.details, null, 2));
  });

  it('should return 400 for invalid email', async () => {
    const customerData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'invalid-email',
      password: 'TestPass123',
      phone_number: '08012345678',
      address: '123 Test Address',
      interested_services: ['plumbing']
    };

    const response = await request(app)
      .post('/api/auth/register/customer')
      .send(customerData);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid phone number', async () => {
    const customerData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      password: 'TestPass123',
      phone_number: 'invalid-phone',
      address: '123 Test Address',
      interested_services: ['plumbing']
    };

    const response = await request(app)
      .post('/api/auth/register/customer')
      .send(customerData);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for weak password', async () => {
    const customerData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      password: 'weak',
      phone_number: '08012345678',
      address: '123 Test Address',
      interested_services: ['plumbing']
    };

    const response = await request(app)
      .post('/api/auth/register/customer')
      .send(customerData);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
