import js from '@eslint/js';
import globals from 'globals';

export default [
  // Base configuration for all JavaScript files
  js.configs.recommended,
  
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'nodejsinstaller/**',
      '*.min.js',
      'data.db*',
      'mailing_list.txt'
    ]
  },
  
  // Configuration for all JS files
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'warn',
      'no-empty': 'warn',
      'no-extra-semi': 'warn',
      'no-irregular-whitespace': 'error',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'eqeqeq': ['warn', 'always'],
      'curly': ['warn', 'all'],
      'no-control-regex': 'off' // Allow control characters in regex (used for sanitization)
    }
  },
  
  // Node.js specific files (server-side)
  {
    files: ['server.js', 'logger.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    }
  },
  
  // Browser-specific files (client-side)
  {
    files: ['admin.js', 'my-bookings.js', 'client-logger.js', 'load-navigation.js', 'calendar.js', 'form-validation.js', 'email-validation.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        // Functions from email-validation.js (loaded dynamically)
        isValidEmail: 'readonly',
        validateAndSanitizeEmail: 'readonly',
        validateEmailInput: 'readonly',
        // FormValidation from form-validation.js
        FormValidation: 'readonly',
        // clientLogger from client-logger.js
        clientLogger: 'readonly',
        // fetchWithTimeout from fetch-with-timeout.js (loaded dynamically)
        fetchWithTimeout: 'readonly'
      }
    }
  }
];
