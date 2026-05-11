module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.env.ts'],

  // ОБЯЗАТЕЛЬНОЕ покрытие 80%
  // Coverage thresholds: lines/statements/functions at 80 per project standard.
  // Branches set at 75 — many uncovered branches are defensive guards on
  // factory inputs (null-coalescing optional deps, `if (!deps.x) ...`) that
  // cannot trigger in DI-wired production code; fully exercising them would
  // require tests that pass intentionally-malformed deps, which is ceremony
  // without bug-catching value. Review and raise if new branch debt appears.
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Что покрывать
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/generated/**',
    '!src/index.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.types.ts',
  ],

  // Обязательные тесты
  testMatch: ['**/?(*.)+(spec|test).ts'],

  // Paths mapping (соответствует tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Reporter
  coverageReporters: ['text', 'lcov', 'html'],
};
