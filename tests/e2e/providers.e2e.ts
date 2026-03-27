import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis, seedAdminUser } from './helpers/test-db';
import { loginUser, registerAndLogin, authHeaders } from './helpers/test-auth';

let app: FastifyInstance;
let adminToken: string;
let regularToken: string;

beforeAll(async () => {
  app = await createTestApp();
  await truncateAllTables();
  await flushTestRedis();
});

afterAll(async () => {
  await closeTestApp(app);
});

describe('Providers E2E', () => {
  it('should seed admin and login', async () => {
    const admin = await seedAdminUser();
    const { body } = await loginUser(app, admin.email, admin.password);
    adminToken = body.accessToken as string;
    expect(adminToken).toBeDefined();
  });

  it('should register a regular user', async () => {
    const result = await registerAndLogin(app);
    regularToken = result.accessToken;
    expect(regularToken).toBeDefined();
  });

  let createdProviderId: string;

  it('POST /providers should create a provider', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/providers',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Test SMM',
        apiEndpoint: 'https://example.com/api/v2',
        apiKey: 'secret-key-123',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('providerId');
    expect(body).toHaveProperty('name', 'Test SMM');
    expect(body).toHaveProperty('apiEndpoint', 'https://example.com/api/v2');
    expect(body).toHaveProperty('isActive', true);
    createdProviderId = body.providerId as string;
  });

  it('GET /providers should list providers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/providers',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('providers');
    expect(body).toHaveProperty('pagination');

    const providerIds = body.providers.map((p: { providerId: string }) => p.providerId);
    expect(providerIds).toContain(createdProviderId);
  });

  it('GET /providers/:providerId should return provider detail without apiKey', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/providers/${createdProviderId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('providerId', createdProviderId);
    expect(body).toHaveProperty('name', 'Test SMM');
    expect(body).toHaveProperty('apiEndpoint', 'https://example.com/api/v2');
    expect(body).toHaveProperty('isActive', true);
    expect(body).not.toHaveProperty('apiKey');
    expect(body).not.toHaveProperty('apiKeyEncrypted');
  });

  it('PUT /providers/:providerId should update provider name', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/providers/${createdProviderId}`,
      headers: authHeaders(adminToken),
      payload: { name: 'Updated SMM Provider' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('name', 'Updated SMM Provider');
  });

  it('GET /providers/:providerId should reflect updated name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/providers/${createdProviderId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('name', 'Updated SMM Provider');
  });

  it('DELETE /providers/:providerId should deactivate provider', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/providers/${createdProviderId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(204);
  });

  it('GET /providers/:providerId should show isActive false after deactivation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/providers/${createdProviderId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('isActive', false);
  });

  it('GET /providers/:providerId/services should return a response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/providers/${createdProviderId}/services`,
      headers: authHeaders(adminToken),
    });

    // Stub provider may return 200 with mock data or an error;
    // we just verify the endpoint does not crash (returns valid HTTP status)
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(500);
  });

  it('GET /providers/:providerId/balance should return a response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/providers/${createdProviderId}/balance`,
      headers: authHeaders(adminToken),
    });

    // Stub provider may return 200 with mock data or an error;
    // we just verify the endpoint does not crash (returns valid HTTP status)
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(500);
  });

  it('GET /providers should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/providers',
      headers: authHeaders(regularToken),
    });

    expect(res.statusCode).toBe(403);
  });
});
