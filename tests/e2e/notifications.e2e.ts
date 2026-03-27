import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis } from './helpers/test-db';
import { registerAndLogin, authHeaders } from './helpers/test-auth';
import { getPrisma } from '@/shared/database/prisma';

let app: FastifyInstance;
let userToken: string;
let userId: string;
let notificationId: string;

beforeAll(async () => {
  app = await createTestApp();
  await truncateAllTables();
  await flushTestRedis();
});

afterAll(async () => {
  await closeTestApp(app);
});

describe('Notifications E2E', () => {
  it('should register a user and login', async () => {
    const result = await registerAndLogin(app);
    userToken = result.accessToken;
    userId = result.userId;
    expect(userToken).toBeDefined();
  });

  it('should seed a notification directly in DB', async () => {
    const prisma = getPrisma();
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'EMAIL',
        channel: 'user@example.com',
        subject: 'Test Notification',
        body: 'Test body content',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
    notificationId = notification.id;
    expect(notificationId).toBeDefined();
  });

  it('GET /notifications should return paginated list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?page=1&limit=20',
      headers: authHeaders(userToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('notifications');
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('page', 1);
    expect(body.pagination).toHaveProperty('limit', 20);
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    expect(body.notifications.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /notifications?status=SENT should filter correctly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?status=SENT',
      headers: authHeaders(userToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notifications.length).toBeGreaterThanOrEqual(1);
    for (const n of body.notifications) {
      expect(n.status).toBe('SENT');
    }
  });

  it('GET /notifications/:notificationId should return detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/notifications/${notificationId}`,
      headers: authHeaders(userToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id', notificationId);
    expect(body).toHaveProperty('type', 'EMAIL');
    expect(body).toHaveProperty('channel', 'user@example.com');
    expect(body).toHaveProperty('subject', 'Test Notification');
    expect(body).toHaveProperty('status', 'SENT');
  });

  it('GET /notifications/:notificationId with non-existent ID should return 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications/00000000-0000-0000-0000-000000000000',
      headers: authHeaders(userToken),
    });

    expect(res.statusCode).toBe(404);
  });

  it('GET /notifications without auth should return 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
    });

    expect(res.statusCode).toBe(401);
  });
});
