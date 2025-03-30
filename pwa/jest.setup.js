/**
 * Jest setup file for Intercom DTI PWA
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
  getLogs: jest.fn().mockResolvedValue([]),
  getErrors: jest.fn().mockResolvedValue([]),
  getSetting: jest.fn().mockResolvedValue(null),
  saveSetting: jest.fn().mockResolvedValue(true),
  saveDeviceInfo: jest.fn().mockResolvedValue(true),
};

global.IntercomSync = {
  init: jest.fn().mockResolvedValue({}),
  syncData: jest.fn().mockResolvedValue(true),
};

// Mock bootstrap
global.bootstrap = {
  Modal: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
  })),
  Toast: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
  })),
  Dropdown: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
  })),
};

// Mock Chart
global.Chart = jest.fn().mockImplementation(() => ({
  update: jest.fn(),
  destroy: jest.fn(),
  render: jest.fn(),
}));

// Mock socket.io
global.io = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window functions
global.showToast = jest.fn();
global.updateTabletStatus = jest.fn();
global.updateLogDisplay = jest.fn();
global.updateServiceStatus = jest.fn();
global.handleDeviceResponse = jest.fn();
global.applyTheme = jest.fn();
global.saveGeneralSettings = jest.fn();
global.saveTabletsSettings = jest.fn();
global.changeAdminPassword = jest.fn();
global.clearLogsByTimePeriod = jest.fn();
global.addLog = jest.fn();
