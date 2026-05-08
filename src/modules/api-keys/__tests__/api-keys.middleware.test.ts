import type { FastifyRequest, FastifyReply } from 'fastify';
import type Redis from 'ioredis';
import type { AppConfig } from '../../../shared/config';
import { createApiKeyAuthMiddleware } from '../api-keys.middleware';
import { hashApiKey } from '../api-keys.service';
import { createFakeApiKeysRepository, silentLogger } from './fakes';
import type { ApiKeyRecord } from '../api-keys.types';

function makeFakeRedis(): {
  redis: Redis;
  incr: jest.Mock;
  expire: jest.Mock;
} {
  const incr = jest.fn<Promise<number>, [string]>().mockResolvedValue(1);
  const expire = jest.fn<Promise<number>, [string, number]>().mockResolvedValue(1);
  const redis = { incr, expire } as unknown as Redis;
  return { redis, incr, expire };
}

function makeConfig(): AppConfig {
  return {
    apiKeys: { rateBasic: 100, ratePro: 500, rateEnterprise: 2000 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as AppConfig;
}

function makeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { headers, user: undefined } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

function seededRecord(overrides: Partial<ApiKeyRecord> & { keyHash?: string } = {}): ApiKeyRecord {
  return {
    id: 'key-1',
    userId: 'user-1',
    keyHash: overrides.keyHash ?? hashApiKey('yb_test'),
    name: 'Test',
    permissions: null,
    rateLimitTier: 'BASIC',
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date(),
    expiresAt: null,
    ...overrides,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('API Key Middleware', () => {
  it('should throw if X-API-Key header is missing', async () => {
    const apiKeysRepo = createFakeApiKeysRepository();
    const { redis } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await expect(middleware(makeRequest(), mockReply)).rejects.toThrow('Missing X-API-Key');
  });

  it('should throw if API key is not found', async () => {
    const apiKeysRepo = createFakeApiKeysRepository();
    const { redis } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await expect(middleware(makeRequest({ 'x-api-key': 'yb_invalid' }), mockReply)).rejects.toThrow(
      'Invalid API key',
    );
  });

  it('should throw if API key is revoked', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({
      keys: [seededRecord({ isActive: false })],
    });
    const { redis } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await expect(middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply)).rejects.toThrow(
      'revoked',
    );
  });

  it('should throw if API key has expired', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({
      keys: [seededRecord({ expiresAt: new Date('2020-01-01') })],
    });
    const { redis } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await expect(middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply)).rejects.toThrow(
      'expired',
    );
  });

  it('should set request.user on valid key', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    const { redis } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    const req = makeRequest({ 'x-api-key': 'yb_test' });
    await middleware(req, mockReply);

    expect(req.user).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      jti: 'key-1',
    });
  });

  it('should increment rate limit counter in Redis', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    const { redis, incr } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);

    expect(incr).toHaveBeenCalledWith('ratelimit:apikey:key-1');
  });

  it('should set 60s TTL on first request', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    const { redis, incr, expire } = makeFakeRedis();
    incr.mockResolvedValue(1);
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);

    expect(expire).toHaveBeenCalledWith('ratelimit:apikey:key-1', 60);
  });

  it('should not set TTL on subsequent requests', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    const { redis, incr, expire } = makeFakeRedis();
    incr.mockResolvedValue(5);
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);

    expect(expire).not.toHaveBeenCalled();
  });

  it('should throw on rate limit exceeded for BASIC tier', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    const { redis, incr } = makeFakeRedis();
    incr.mockResolvedValue(101);
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await expect(middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply)).rejects.toThrow(
      'Rate limit exceeded',
    );
  });

  it('should allow higher limits for PRO tier', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({
      keys: [seededRecord({ rateLimitTier: 'PRO' })],
    });
    const { redis, incr } = makeFakeRedis();
    incr.mockResolvedValue(200);
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    const req = makeRequest({ 'x-api-key': 'yb_test' });
    await middleware(req, mockReply);

    expect(req.user).toBeDefined();
  });

  it('should allow higher limits for ENTERPRISE tier', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({
      keys: [seededRecord({ rateLimitTier: 'ENTERPRISE' })],
    });
    const { redis, incr } = makeFakeRedis();
    incr.mockResolvedValue(1500);
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    const req = makeRequest({ 'x-api-key': 'yb_test' });
    await middleware(req, mockReply);

    expect(req.user).toBeDefined();
  });

  it('should fire-and-forget lastUsedAt update', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    const { redis } = makeFakeRedis();
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger: silentLogger,
    });

    await middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);
    await flushMicrotasks();

    expect(apiKeysRepo.calls.updateLastUsedAt).toContain('key-1');
  });

  it('should not throw when updateLastUsedAt fails (fire-and-forget)', async () => {
    const apiKeysRepo = createFakeApiKeysRepository({ keys: [seededRecord()] });
    apiKeysRepo.setUpdateLastUsedAtFailure(new Error('boom'));
    const { redis } = makeFakeRedis();
    const warn = jest.fn();
    const logger = { ...silentLogger, warn } as unknown as typeof silentLogger;
    const middleware = createApiKeyAuthMiddleware({
      apiKeysRepo,
      redis,
      config: makeConfig(),
      logger,
    });

    await expect(
      middleware(makeRequest({ 'x-api-key': 'yb_test' }), mockReply),
    ).resolves.toBeUndefined();
    await flushMicrotasks();
    expect(warn).toHaveBeenCalled();
  });
});
