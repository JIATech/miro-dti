/**
 * Jest setup file for Intercom DTI Admin
 */

// Mock global objects that would be available in browser environments
global.IntercomDB = {
  initDB: jest.fn().mockResolvedValue(true),
  addLogEntry: jest.fn().mockResolvedValue(true),
  addErrorEntry: jest.fn().mockResolvedValue(true),
  addCallEntry: jest.fn().mockResolvedValue(true),
  updateLastCallEntry: jest.fn().mockResolvedValue(true),
  getCallStats: jest.fn().mockResolvedValue({}),
  getCallHistory: jest.fn().mockResolvedValue([]),
  getSetting: jest.fn().mockResolvedValue(null),
  saveSetting: jest.fn().mockResolvedValue(true),
  saveDeviceInfo: jest.fn().mockResolvedValue(true),
};

global.IntercomSync = {
  init: jest.fn().mockResolvedValue({}),
  syncData: jest.fn().mockResolvedValue(true),
  setAdminServer: jest.fn().mockResolvedValue(true),
};

// Setup console mocks to prevent cluttering test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
