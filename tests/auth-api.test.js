const request = require('supertest');
const app = require('../src/web-server').app;
const mongoose = require('mongoose');
const User = require('../src/db/models/User');
const config = require('../config/config');

beforeAll(async () => {
  // Connect to the test database
  await mongoose.connect(config.database.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // Create a test user
  await User.create({
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'password123',
    role: 'user'
  });
});

afterAll(async () => {
  // Clean up the test database
  await User.deleteMany({ email: 'testuser@example.com' });
  await mongoose.disconnect();
});

describe('Authentication API', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'newpassword123'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('newuser@example.com');

    // Clean up
    await User.deleteOne({ email: 'newuser@example.com' });
  });

  it('should log in an existing user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
  });

  it('should fail to log in with incorrect credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'wrongpassword'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Invalid credentials');
  });
});