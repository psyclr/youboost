// Shared ESLint base for the monorepo's TypeScript node services (backend +
// blog-engine). The frontend uses eslint-config-next (React/Next) and only needs
// the formatting-compatible style here, so it is configured separately.
//
// Usage in a package's eslint.config.mjs:
//   import { baseTsConfig, baseTestOverrides } from '../eslint.base.mjs';
//   export default [ baseTsConfig({ project: './tsconfig.json' }), ... ];

import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';

const NODE_GLOBALS = {
  console: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
};

/** The cross-service rule set (strictness, security, complexity, style). */
export const baseRules = {
  'no-console': 'error',
  'no-debugger': 'error',
  'no-alert': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
  'no-unused-vars': 'off',

  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/explicit-function-return-type': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',

  'no-eval': 'error',
  'no-implied-eval': 'error',

  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-lines': ['error', 300],
  'max-params': ['error', 3],

  'arrow-body-style': ['error', 'as-needed'],
  'prefer-arrow-callback': 'error',
  'prefer-template': 'error',
  quotes: ['error', 'single', { avoidEscape: true }],
  semi: ['error', 'always'],

  'unicorn/prevent-abbreviations': 'off',
  'unicorn/no-null': 'off',
  'unicorn/prefer-module': 'off',
};

/**
 * Build the shared TS config object for a node service.
 * @param {{ project: string, files?: string[] }} opts
 */
export function baseTsConfig({ project, files = ['**/*.ts', '**/*.tsx'] }) {
  return {
    files,
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', project },
      globals: NODE_GLOBALS,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security,
      sonarjs,
      unicorn,
    },
    rules: baseRules,
  };
}

/** Relaxed rules for test files (shared by both services). */
export function baseTestOverrides(files) {
  return {
    files,
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'max-params': 'off',
      complexity: 'off',
    },
  };
}
