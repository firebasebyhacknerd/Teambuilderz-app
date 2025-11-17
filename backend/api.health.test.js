process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const { app } = require('./server');

describe('API Health Check', () => {
  it('should respond with 200 OK for the root endpoint', async () => {
    // Send a GET request to the root path
    const response = await request(app).get('/');

    // Assert that the status code is 200
    expect(response.statusCode).toBe(200);

    // Assert that the response body contains the expected health check message
    expect(response.body).toEqual({ message: 'Backend is running' });
  });
});
