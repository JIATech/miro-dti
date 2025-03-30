/**
 * Configuración de Jest para Intercom DTI - PWA
 */

module.exports = {
  // Directorio donde Jest buscará los archivos de test
  testMatch: ['**/tests/**/*.test.js'],

  // Ignorar directorios de node_modules
  testPathIgnorePatterns: ['/node_modules/'],

  // Colectar información de cobertura
  collectCoverage: true,

  // Directorio donde se guardarán los informes de cobertura
  coverageDirectory: 'coverage',

  // Archivos para los que se medirá la cobertura
  collectCoverageFrom: ['public/js/**/*.js', '!**/node_modules/**'],

  // Configurar el entorno de pruebas para simular navegador
  testEnvironment: 'jsdom',

  // Configuración para mocks
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/tests/mocks/styleMock.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/tests/mocks/fileMock.js',
  },
};
