import { baseTsConfig, baseTestOverrides } from '../eslint.base.mjs';

// blog-engine is a node service like the backend, so it shares the monorepo base.
export default [
  baseTsConfig({ project: './tsconfig.json', files: ['src/**/*.ts'] }),
  {
    // Ratchet (same convention as the frontend's complexity warn): blog-engine is
    // young scaffolding that iteration 4 will extend heavily. Surface these as
    // warnings now; tighten to the base's `error` as the code stabilizes.
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      complexity: 'warn',
    },
  },
  baseTestOverrides(['src/**/__tests__/**/*.ts', 'src/**/*.test.ts']),
  {
    ignores: ['node_modules/', 'dist/', 'src/generated/'],
  },
];
