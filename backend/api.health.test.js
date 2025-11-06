const request = require('supertest');
const { app, server } = require('../server'); // Import app and server

describe('API Health Check', () => {
  // This hook ensures the server is closed after all tests in this file are done
  afterAll((done) => {
    server.close(done);
  });

  it('should respond with 200 OK for the root endpoint', async () => {
    // Send a GET request to the root path
    const response = await request(app).get('/');

    // Assert that the status code is 200
    expect(response.statusCode).toBe(200);

    // Assert that the response body contains the expected health check message
    expect(response.body).toEqual({ message: 'Backend is running' });
  });
});