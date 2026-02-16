import { authenticateApiKey } from '../api-keys.middleware';
import type { FastifyRequest, FastifyReply } from 'fastify';

const mockFindApiKeyByHash = jest.fn();
const mockUpdateLastUsedAt = jest.fn();
const mockIncr = jest.fn();
const mockExpire = jest.fn();

jest.mock('../api-keys.repository', () => ({
  findApiKeyByHash: (...args: unknown[]): unknown => mockFindApiKeyByHash(...args),
  updateLastUsedAt: (...args: unknown[]): unknown => mockUpdateLastUsedAt(...args),
}));

jest.mock('../../../shared/redis/redis', () => ({
  getRedis: jest.fn().mockReturnValue({
    incr: (...args: unknown[]): unknown => mockIncr(...args),
    expire: (...args: unknown[]): unknown => mockExpire(...args),
  }),
}));

jest.mock('../../../shared/config/env', () => ({
  getConfig: jest.fn().mockReturnValue({
    apiKeys: { rateBasic: 100, ratePro: 500, rateEnterprise: 2000 },
  }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockRecord = {
  id: 'key-1',
  userId: 'user-1',
  keyHash: 'hash',
  name: 'Test',
  permissions: null,
  rateLimitTier: 'BASIC',
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  expiresAt: null,
  user: { role: 'USER', email: 'a@b.com' },
};

function makeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { headers, user: undefined } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

describe('API Key Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
    mockUpdateLastUsedAt.mockResolvedValue(undefined);
  });

  it('should throw if X-API-Key header is missing', async () => {
    await expect(authenticateApiKey(makeRequest(), mockReply)).rejects.toThrow('Missing X-API-Key');
  });

  it('should throw if API key is not found', async () => {
    mockFindApiKeyByHash.mockResolvedValue(null);
    await expect(
      authenticateApiKey(makeRequest({ 'x-api-key': 'yb_invalid' }), mockReply),
    ).rejects.toThrow('Invalid API key');
  });

  it('should throw if API key is revoked', async () => {
    mockFindApiKeyByHash.mockResolvedValue({ ...mockRecord, isActive: false });
    await expect(
      authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply),
    ).rejects.toThrow('revoked');
  });

  it('should throw if API key has expired', async () => {
    mockFindApiKeyByHash.mockResolvedValue({
      ...mockRecord,
      expiresAt: new Date('2020-01-01'),
    });
    await expect(
      authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply),
    ).rejects.toThrow('expired');
  });

  it('should set request.user on valid key', async () => {
    mockFindApiKeyByHash.mockResolvedValue(mockRecord);
    const req = makeRequest({ 'x-api-key': 'yb_test' });
    await authenticateApiKey(req, mockReply);
    expect(req.user).toEqual({
      userId: 'user-1',
      email: 'a@b.com',
      role: 'USER',
      jti: 'key-1',
    });
  });

  it('should increment rate limit counter in Redis', async () => {
    mockFindApiKeyByHash.mockResolvedValue(mockRecord);
    await authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);
    expect(mockIncr).toHaveBeenCalledWith('ratelimit:apikey:key-1');
  });

  it('should set 60s TTL on first request', async () => {
    mockFindApiKeyByHash.mockResolvedValue(mockRecord);
    mockIncr.mockResolvedValue(1);
    await authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);
    expect(mockExpire).toHaveBeenCalledWith('ratelimit:apikey:key-1', 60);
  });

  it('should not set TTL on subsequent requests', async () => {
    mockFindApiKeyByHash.mockResolvedValue(mockRecord);
    mockIncr.mockResolvedValue(5);
    await authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('should throw on rate limit exceeded for BASIC tier', async () => {
    mockFindApiKeyByHash.mockResolvedValue(mockRecord);
    mockIncr.mockResolvedValue(101);
    await expect(
      authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply),
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('should allow higher limits for PRO tier', async () => {
    mockFindApiKeyByHash.mockResolvedValue({ ...mockRecord, rateLimitTier: 'PRO' });
    mockIncr.mockResolvedValue(200);
    const req = makeRequest({ 'x-api-key': 'yb_test' });
    await authenticateApiKey(req, mockReply);
    expect(req.user).toBeDefined();
  });

  it('should allow higher limits for ENTERPRISE tier', async () => {
    mockFindApiKeyByHash.mockResolvedValue({ ...mockRecord, rateLimitTier: 'ENTERPRISE' });
    mockIncr.mockResolvedValue(1500);
    const req = makeRequest({ 'x-api-key': 'yb_test' });
    await authenticateApiKey(req, mockReply);
    expect(req.user).toBeDefined();
  });

  it('should fire-and-forget lastUsedAt update', async () => {
    mockFindApiKeyByHash.mockResolvedValue(mockRecord);
    await authenticateApiKey(makeRequest({ 'x-api-key': 'yb_test' }), mockReply);
    expect(mockUpdateLastUsedAt).toHaveBeenCalledWith('key-1');
  });
});
