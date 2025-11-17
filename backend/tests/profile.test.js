process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.SKIP_DB_SETUP = 'true';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mockPoolInstance = {
  query: jest.fn(),
  connect: jest.fn(() => Promise.resolve({ release: jest.fn() })),
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPoolInstance),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../services/profileService', () => ({
  fetchUserProfile: jest.fn(),
}));

const { fetchUserProfile } = require('../services/profileService');
const { app } = require('../server');

describe('GET /api/v1/profile', () => {
  beforeEach(() => {
    mockPoolInstance.query.mockReset();
    mockPoolInstance.connect.mockClear();
    jwt.verify.mockReset();
    mockPoolInstance.query.mockResolvedValue({ rows: [] });
    fetchUserProfile.mockReset();
  });

  it('should return user profile data for a valid token', async () => {
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'Admin',
      daily_quota: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const decodedToken = { userId: 1, role: 'Admin' };
    jwt.verify.mockReturnValue(decodedToken);

    fetchUserProfile.mockResolvedValueOnce(mockUser);

    const response = await request(app).get('/api/v1/profile').set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockUser);
    expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
    expect(fetchUserProfile).toHaveBeenCalledWith(mockPoolInstance, decodedToken.userId);
  });

  it('rejects requests without a bearer token', async () => {
    const response = await request(app).get('/api/v1/profile');
    expect(response.status).toBe(401);
    expect(fetchUserProfile).not.toHaveBeenCalled();
  });

  it('returns 404 when profile is missing', async () => {
    const decodedToken = { userId: 99, role: 'Recruiter' };
    jwt.verify.mockReturnValue(decodedToken);
    fetchUserProfile.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/v1/profile').set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'User not found' });
  });
});
