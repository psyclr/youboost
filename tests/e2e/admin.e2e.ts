import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis, seedAdminUser } from './helpers/test-db';
import { loginUser, registerAndLogin, authHeaders } from './helpers/test-auth';

let app: FastifyInstance;

let adminToken: string;
let adminUserId: string;
let regularUserId: string;
let regularToken: string;

beforeAll(async () => {
  app = await createTestApp();
  await truncateAllTables();
  await flushTestRedis();
});

afterAll(async () => {
  await closeTestApp(app);
});

describe('Admin E2E', () => {
  it('should seed admin user and login as admin', async () => {
    const admin = await seedAdminUser();
    adminUserId = admin.id;

    const { statusCode, body } = await loginUser(app, admin.email, admin.password);

    expect(statusCode).toBe(200);
    expect(body).toHaveProperty('accessToken');
    adminToken = body.accessToken as string;
  });

  it('should register a regular user', async () => {
    const result = await registerAndLogin(app);

    regularUserId = result.userId;
    regularToken = result.accessToken;

    expect(regularUserId).toBeDefined();
    expect(regularToken).toBeDefined();
  });

  it('GET /admin/users should list both users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('users');
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('limit');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    expect(body.users.length).toBeGreaterThanOrEqual(2);

    const userIds = body.users.map((u: { userId: string }) => u.userId);
    expect(userIds).toContain(adminUserId);
    expect(userIds).toContain(regularUserId);
  });

  it('GET /admin/users/:userId should return user detail with wallet', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/admin/users/${regularUserId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('userId', regularUserId);
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('username');
    expect(body).toHaveProperty('role');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('emailVerified');
    expect(body).toHaveProperty('wallet');
  });

  it('PATCH /admin/users/:userId should update role to RESELLER', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${regularUserId}`,
      headers: authHeaders(adminToken),
      payload: { role: 'RESELLER' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('role', 'RESELLER');
  });

  it('POST /admin/users/:userId/balance/adjust should credit balance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/users/${regularUserId}/balance/adjust`,
      headers: authHeaders(adminToken),
      payload: { amount: 50, reason: 'E2E test credit' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('success', true);
  });

  it('GET /admin/dashboard/stats should return stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/dashboard/stats',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('totalUsers');
    expect(body.totalUsers).toBeGreaterThanOrEqual(2);
    expect(body).toHaveProperty('totalOrders');
    expect(body).toHaveProperty('totalRevenue');
    expect(body).toHaveProperty('activeServices');
  });

  let createdServiceId: string;

  it('POST /admin/services should create a service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/services',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Test Service',
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: 5.0,
        minQuantity: 100,
        maxQuantity: 100000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('serviceId');
    expect(body).toHaveProperty('name', 'Test Service');
    expect(body).toHaveProperty('platform', 'YOUTUBE');
    expect(body).toHaveProperty('type', 'VIEWS');
    expect(body).toHaveProperty('pricePer1000', 5.0);
    expect(body).toHaveProperty('minQuantity', 100);
    expect(body).toHaveProperty('maxQuantity', 100000);
    expect(body).toHaveProperty('isActive', true);

    createdServiceId = body.serviceId as string;
  });

  it('GET /admin/services should list the created service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/services',
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('services');

    const serviceIds = body.services.map((s: { serviceId: string }) => s.serviceId);
    expect(serviceIds).toContain(createdServiceId);
  });

  it('PATCH /admin/services/:serviceId should update price', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/services/${createdServiceId}`,
      headers: authHeaders(adminToken),
      payload: { pricePer1000: 7.5 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('pricePer1000', 7.5);
  });

  it('DELETE /admin/services/:serviceId should deactivate service', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/admin/services/${createdServiceId}`,
      headers: authHeaders(adminToken),
    });

    expect(res.statusCode).toBe(204);
  });

  it('GET /admin/users should return 403 for regular user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: authHeaders(regularToken),
    });

    expect(res.statusCode).toBe(403);
  });
});
