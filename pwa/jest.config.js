/**
 * Configuración de Jest para Intercom DTI PWA
 */

module.exports = {
  // Directorio raíz donde Jest buscará los archivos
  rootDir: './',
  
  // Archivos de test a ejecutar
  testMatch: ['**/*.test.js'],
  
  // Directorios a ignorar
  testPathIgnorePatterns: ['/node_modules/'],
  
  // Directorios de cobertura
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!jest.config.js',
  ],
  
  // Configuración de ambiente
  testEnvironment: 'jsdom',
  
  // Archivos a ejecutar antes de los tests
  setupFiles: ['./jest.setup.js'],
  
  // Módulos para transformar archivos
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Módulos a ignorar en transformación
  transformIgnorePatterns: ['/node_modules/'],
  
  // Variables globales para todos los tests
  globals: {
    // Mocks para dependencias globales
  },
  
  // Nivel de verbosidad
  verbose: true,
};
