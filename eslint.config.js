const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const security = require('eslint-plugin-security');
const sonarjs = require('eslint-plugin-sonarjs');
const unicorn = require('eslint-plugin-unicorn');
const boundaries = require('eslint-plugin-boundaries');

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
      'boundaries': boundaries,
    },
    settings: {
      'boundaries/elements': [
        // Module public surface — the barrel. One per module.
        { type: 'module-public', pattern: 'src/modules/*/index.ts', mode: 'full', capture: ['name'] },
        // Module internals — everything else under the module directory.
        { type: 'module-internal', pattern: 'src/modules/*/**/*.ts', mode: 'full', capture: ['name'] },
        // Composition root — allowed to reach into any module internal.
        { type: 'composition', pattern: 'src/composition/**/*.ts' },
        { type: 'composition', pattern: 'src/app.ts' },
        { type: 'composition', pattern: 'src/index.ts' },
        // Shared infra — cross-cutting, importable from anywhere.
        { type: 'shared', pattern: 'src/shared/**/*.ts' },
        // Generated Prisma code — infra.
        { type: 'generated', pattern: 'src/generated/**/*.ts' },
      ],
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
    // Module boundary enforcement via eslint-plugin-boundaries.
    //
    // Rules:
    //   - module-internal files may import siblings in their own module
    //     and from their own index (module-public).
    //   - module-internal files may NOT import from another module's
    //     internals — only that module's public barrel.
    //   - module-public (barrel) may import any internal of its own module.
    //   - composition root (app.ts, index.ts, src/composition/) may reach
    //     into any module's internals for explicit wiring.
    //   - shared/* is importable from anywhere; generated/* too.
    files: ['src/**/*.ts'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.ts'],
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // Internal → own internals (same module).
            {
              from: { type: 'module-internal' },
              allow: {
                to: { type: 'module-internal', captured: { name: '{{from.captured.name}}' } },
              },
            },
            // Internal → any public barrel.
            {
              from: { type: 'module-internal' },
              allow: { to: { type: 'module-public' } },
            },
            // Internal → shared / generated.
            {
              from: { type: 'module-internal' },
              allow: { to: { type: ['shared', 'generated'] } },
            },
            // Public barrel → own internals (same module).
            {
              from: { type: 'module-public' },
              allow: {
                to: { type: 'module-internal', captured: { name: '{{from.captured.name}}' } },
              },
            },
            // Public barrel → other public barrels (not itself).
            {
              from: { type: 'module-public' },
              allow: {
                to: { type: 'module-public', captured: { name: '!{{from.captured.name}}' } },
              },
            },
            // Public barrel → shared / generated.
            {
              from: { type: 'module-public' },
              allow: { to: { type: ['shared', 'generated'] } },
            },
            // Composition root → may reach anywhere.
            {
              from: { type: 'composition' },
              allow: {
                to: { type: ['module-internal', 'module-public', 'composition', 'shared', 'generated'] },
              },
            },
            // Shared → only shared or generated.
            {
              from: { type: 'shared' },
              allow: { to: { type: ['shared', 'generated'] } },
            },
          ],
        },
      ],
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
