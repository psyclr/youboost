const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const security = require('eslint-plugin-security');
const sonarjs = require('eslint-plugin-sonarjs');
const unicorn = require('eslint-plugin-unicorn');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.eslint.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'security': security,
      'sonarjs': sonarjs,
      'unicorn': unicorn,
    },
    rules: {
      // МАКСИМАЛЬНАЯ СТРОГОСТЬ
      'no-console': 'error',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': 'off',

      // TypeScript строгость
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Безопасность
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Сложность кода
      'complexity': ['error', 10],
      'max-depth': ['error', 3],
      'max-lines': ['error', 300],
      'max-params': ['error', 3],

      // Стиль кода
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],

      // Unicorn правила (некоторые отключаем)
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-module': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
      'max-params': 'off',
      'complexity': 'off',
    },
  },
  {
    files: ['src/**/__tests__/**/*.ts'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'max-params': 'off',
      'complexity': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '*.config.js',
      'prisma.config.ts',
      'prisma/seed.ts',
      'src/generated/',
      '.claude/',
      'docs/',
      'frontend/',
    ],
  },
];
