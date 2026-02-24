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

describe('Webhooks E2E', () => {
  let accessToken: string;
  let webhookId: string;

  it('should register and login a user', async () => {
    const result = await registerAndLogin(app);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('userId');

    accessToken = result.accessToken;
  });

  it('should create a webhook', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks',
      headers: authHeaders(accessToken),
      payload: {
        url: 'https://example.com/webhook',
        events: ['order.created', 'order.completed'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    expect(body.url).toBe('https://example.com/webhook');
    expect(body.events).toEqual(['order.created', 'order.completed']);
    expect(body.isActive).toBe(true);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('lastTriggeredAt');
    expect(body).toHaveProperty('createdAt');
    expect(body).not.toHaveProperty('secret');

    webhookId = body.id as string;
  });

  it('should list webhooks with one webhook present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/webhooks',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body).toHaveProperty('webhooks');
    expect(body).toHaveProperty('pagination');
    expect(body.webhooks).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('should get a webhook by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/webhooks/${webhookId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.id).toBe(webhookId);
    expect(body.url).toBe('https://example.com/webhook');
    expect(body.events).toEqual(['order.created', 'order.completed']);
    expect(body.isActive).toBe(true);
  });

  it('should update the webhook URL', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/webhooks/${webhookId}`,
      headers: authHeaders(accessToken),
      payload: { url: 'https://example.com/webhook-v2' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.url).toBe('https://example.com/webhook-v2');
    expect(body.events).toEqual(['order.created', 'order.completed']);
  });

  it('should delete the webhook', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/webhooks/${webhookId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(204);
  });

  it('should list webhooks as empty after deletion', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/webhooks',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.webhooks).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });
});
