module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // ОБЯЗАТЕЛЬНОЕ покрытие 80%
  coverageThreshold: {
    global: {
      branches: 80,
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
  ],

  // Обязательные тесты
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],

  // Paths mapping (соответствует tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Reporter
  coverageReporters: ['text', 'lcov', 'html'],
};
