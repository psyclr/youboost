// Test-only env defaults. Individual tests can override via jest.mock of
// '@/shared/config' or by setting process.env before importing modules.
// These values satisfy the Zod schema in src/shared/config/env.ts so
// tests that boot the real createApp or call getConfig() don't fail at
// startup when running outside a shell with .env sourced.
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';
process.env['NODE_ENV'] ??= 'test';
process.env['JWT_SECRET'] ??= 'test-jwt-secret-at-least-32-characters-long';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret-at-least-32-chars-long';
process.env['PROVIDER_ENCRYPTION_KEY'] ??= 'test-provider-encryption-key-32+chars-long';
process.env['CORS_ORIGIN'] ??= 'http://localhost:3001';
