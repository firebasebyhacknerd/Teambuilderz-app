module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/'],
  coverageReporters: ['text', 'lcov'],
  testTimeout: 10000,
};