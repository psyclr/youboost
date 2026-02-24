import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis } from './helpers/test-db';
import { registerAndLogin, authHeaders } from './helpers/test-auth';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  await truncateAllTables();
  await flushTestRedis();
});

afterAll(async () => {
  await closeTestApp(app);
});

describe('API Keys E2E', () => {
  let accessToken: string;
  let keyId: string;

  it('should register and login a user', async () => {
    const result = await registerAndLogin(app);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('userId');

    accessToken = result.accessToken;
  });

  it('should create an API key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api-keys',
      headers: authHeaders(accessToken),
      payload: { name: 'Test API Key', rateLimitTier: 'BASIC' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    expect(body).toHaveProperty('rawKey');
    expect(body.rawKey).toMatch(/^yb_/);

    expect(body).toHaveProperty('apiKey');
    expect(body.apiKey.isActive).toBe(true);
    expect(body.apiKey.name).toBe('Test API Key');
    expect(body.apiKey.rateLimitTier).toBe('BASIC');
    expect(body.apiKey).toHaveProperty('id');
    expect(body.apiKey).toHaveProperty('lastUsedAt');
    expect(body.apiKey).toHaveProperty('createdAt');
    expect(body.apiKey).toHaveProperty('expiresAt');

    keyId = body.apiKey.id as string;
  });

  it('should list API keys with one key present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api-keys',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body).toHaveProperty('apiKeys');
    expect(body).toHaveProperty('pagination');
    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0].isActive).toBe(true);
    expect(body.pagination.total).toBe(1);
  });

  it('should revoke (delete) the API key', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api-keys/${keyId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(204);
  });

  it('should show API key as inactive after revocation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api-keys',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0].isActive).toBe(false);
  });
});
