export const TEST_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test',
  REDIS_URL: 'redis://localhost:6379/1',
  JWT_SECRET: 'test-jwt-secret-key-for-e2e-testing',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key-for-e2e',
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  PROVIDER_ENCRYPTION_KEY: 'test-encryption-key-32-chars-long!!',
  PROVIDER_MODE: 'stub',
  BCRYPT_ROUNDS: '4',
  RATE_LIMIT_MAX: '10000',
  RATE_LIMIT_WINDOW_MS: '60000',
  NODE_ENV: 'test',
  PORT: '0',
  LOG_LEVEL: 'error',
  CORS_ORIGIN: '*',
};

export function applyTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }
}
