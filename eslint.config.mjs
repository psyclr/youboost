import boundaries from 'eslint-plugin-boundaries';
import { baseTsConfig, baseTestOverrides } from './eslint.base.mjs';

export default [
  // Shared base (strictness, security, complexity, style) for the backend.
  baseTsConfig({ project: './tsconfig.eslint.json' }),
  {
    // Module boundary enforcement via eslint-plugin-boundaries (backend-only).
    //   - module-internal may import its own internals + any public barrel.
    //   - module-internal may NOT import another module's internals.
    //   - public barrel may import its own internals + other barrels.
    //   - composition root (app.ts, index.ts, src/composition/) may reach anywhere.
    //   - shared/* and generated/* are importable from anywhere.
    files: ['src/**/*.ts'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'module-public', pattern: 'src/modules/*/index.ts', mode: 'full', capture: ['name'] },
        { type: 'module-internal', pattern: 'src/modules/*/**/*.ts', mode: 'full', capture: ['name'] },
        { type: 'composition', pattern: 'src/composition/**/*.ts' },
        { type: 'composition', pattern: 'src/app.ts' },
        { type: 'composition', pattern: 'src/index.ts' },
        { type: 'shared', pattern: 'src/shared/**/*.ts' },
        { type: 'generated', pattern: 'src/generated/**/*.ts' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: 'module-internal' },
              allow: { to: { type: 'module-internal', captured: { name: '{{from.captured.name}}' } } },
            },
            { from: { type: 'module-internal' }, allow: { to: { type: 'module-public' } } },
            { from: { type: 'module-internal' }, allow: { to: { type: ['shared', 'generated'] } } },
            {
              from: { type: 'module-public' },
              allow: { to: { type: 'module-internal', captured: { name: '{{from.captured.name}}' } } },
            },
            {
              from: { type: 'module-public' },
              allow: { to: { type: 'module-public', captured: { name: '!{{from.captured.name}}' } } },
            },
            { from: { type: 'module-public' }, allow: { to: { type: ['shared', 'generated'] } } },
            {
              from: { type: 'composition' },
              allow: {
                to: { type: ['module-internal', 'module-public', 'composition', 'shared', 'generated'] },
              },
            },
            { from: { type: 'shared' }, allow: { to: { type: ['shared', 'generated'] } } },
          ],
        },
      ],
    },
  },
  baseTestOverrides(['tests/**/*.ts']),
  baseTestOverrides(['src/**/__tests__/**/*.ts']),
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
      'blog-engine/',
    ],
  },
];
