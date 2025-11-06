
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const server = require('../server'); // Assuming server exports the app instance

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

describe('GET /api/v1/profile', () => {
  let pool;
  beforeEach(() => {
    pool = new Pool();
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    pool.query.mockResolvedValueOnce({ rows: [mockUser] });
    pool.query.mockResolvedValueOnce({ rows: [] }); // for the update last_active_at query

    const mReq = {
      headers: {
        authorization: 'Bearer valid-token',
      },
      user: decodedToken,
    };
    const mRes = {
      json: jest.fn(),
      status: jest.fn(() => mRes),
    };
    const mNext = jest.fn();

    // Need to find a way to invoke the route handler
    // This is tricky because the route handlers are not exported directly
    // For now, I will just write the test structure
    // and then figure out how to invoke the route handler

    // This is a placeholder for the actual invocation
    // await getProfileHandler(mReq, mRes);

    // expect(mRes.status).not.toHaveBeenCalled();
    // expect(mRes.json).toHaveBeenCalledWith(mockUser);
  });
});
