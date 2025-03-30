module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['jest'],
  rules: {
    // Errores de sintaxis
    'no-undef': 'error',
    'no-unused-vars': 'warn',

    // Estilo
    indent: ['warn', 2],
    quotes: ['warn', 'single'],
    semi: ['warn', 'always'],

    // Específicas para el proyecto
    'no-console': 'off', // Permitimos console.log para desarrollo
    'max-len': ['warn', { code: 120 }],
  },
  ignorePatterns: ['node_modules/', 'coverage/'],
};
