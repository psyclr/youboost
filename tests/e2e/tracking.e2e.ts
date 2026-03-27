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

describe('Tracking Links E2E', () => {
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

  let createdLinkId: string;

  it('POST /admin/tracking-links should create a tracking link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/tracking-links',
      headers: authHeaders(adminToken),
      payload: { code: 'summer-2024', name: 'Summer Campaign' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('code', 'summer-2024');
    expect(body).toHaveProperty('name', 'Summer Campaign');
    createdLinkId = body.id as string;
  });

  it('GET /admin/tracking-links should list tracking links', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tracking-links',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const link = body.find((l: { id: string }) => l.id === createdLinkId);
    expect(link).toBeDefined();
    expect(link.code).toBe('summer-2024');
    expect(link.name).toBe('Summer Campaign');
    expect(link.registrations).toBe(0);
  });

  it('POST /admin/tracking-links with duplicate code should return 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/tracking-links',
      headers: authHeaders(adminToken),
      payload: { code: 'summer-2024', name: 'Duplicate Campaign' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('DELETE /admin/tracking-links/:linkId should delete the link', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/admin/tracking-links/${createdLinkId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(204);
  });

  it('GET /admin/tracking-links should return empty after deletion', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tracking-links',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    const link = body.find((l: { id: string }) => l.id === createdLinkId);
    expect(link).toBeUndefined();
  });

  it('DELETE /admin/tracking-links/:linkId with non-existent ID should return 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/tracking-links/00000000-0000-0000-0000-000000000000',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(404);
  });

  it('GET /admin/tracking-links should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tracking-links',
      headers: authHeaders(regularToken),
    });

    expect(res.statusCode).toBe(403);
  });
});
