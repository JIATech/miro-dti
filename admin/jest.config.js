/**
 * Jest configuration for Intercom DTI Admin
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Files to test
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  
  // Files to ignore
  testPathIgnorePatterns: ['/node_modules/'],
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Transform configuration
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Global variables
  globals: {
    IntercomDB: {},
    IntercomSync: {}
  }
};
