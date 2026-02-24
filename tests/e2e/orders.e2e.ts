import type { FastifyInstance } from 'fastify';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { truncateAllTables, flushTestRedis, seedService, seedProvider } from './helpers/test-db';
import { registerAndLogin, authHeaders } from './helpers/test-auth';

let app: FastifyInstance;
let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

beforeAll(async () => {
  app = await createTestApp({ PROVIDER_MODE: 'real' });
  await truncateAllTables();
  await flushTestRedis();
  await seedProvider();

  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ order: 12345 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterAll(async () => {
  fetchSpy.mockRestore();
  await closeTestApp(app);
});

describe('Orders E2E — happy path', () => {
  let accessToken: string;
  let serviceId: string;
  let orderId: string;

  it('should register, login, and fund wallet with $100', async () => {
    const user = await registerAndLogin(app, {
      email: 'orders-test@example.com',
      username: 'orders_test_user',
    });
    accessToken = user.accessToken;

    // Create deposit
    const depositRes = await app.inject({
      method: 'POST',
      url: '/billing/deposit',
      headers: authHeaders(accessToken),
      payload: {
        amount: 100,
        currency: 'USD',
        paymentMethod: 'crypto',
        cryptoCurrency: 'USDT',
      },
    });
    expect(depositRes.statusCode).toBe(201);
    const depositBody = JSON.parse(depositRes.body);
    const depositId = depositBody.depositId as string;

    // Confirm deposit
    const confirmRes = await app.inject({
      method: 'POST',
      url: `/billing/deposits/${depositId}/confirm`,
      headers: authHeaders(accessToken),
      payload: { txHash: '0xfunding-tx-hash' },
    });
    expect(confirmRes.statusCode).toBe(200);

    // Verify balance
    const balanceRes = await app.inject({
      method: 'GET',
      url: '/billing/balance',
      headers: authHeaders(accessToken),
    });
    expect(balanceRes.statusCode).toBe(200);
    const balanceBody = JSON.parse(balanceRes.body);
    expect(balanceBody.balance).toBe(100);
  });

  it('should seed a YouTube Views service', async () => {
    const service = await seedService({
      name: 'YouTube Views',
      platform: 'YOUTUBE',
      type: 'VIEWS',
      pricePer1000: 2.5,
      minQuantity: 100,
      maxQuantity: 1000000,
    });

    expect(service.id).toBeDefined();
    serviceId = service.id;
  });

  it('should create an order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: authHeaders(accessToken),
      payload: {
        serviceId,
        link: 'https://youtube.com/watch?v=test123',
        quantity: 1000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('orderId');
    expect(body).toHaveProperty('price', 2.5);
    expect(body).toHaveProperty('status', 'PROCESSING');

    orderId = body.orderId as string;
  });

  it('should list orders with one entry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]).toHaveProperty('orderId', orderId);
  });

  it('should get order detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('orderId', orderId);
    expect(body).toHaveProperty('serviceId', serviceId);
    expect(body).toHaveProperty('status', 'PROCESSING');
    expect(body).toHaveProperty('quantity', 1000);
    expect(body).toHaveProperty('price', 2.5);
  });

  it('should cancel the order and receive a refund', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/orders/${orderId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('orderId', orderId);
    expect(body).toHaveProperty('status', 'CANCELLED');
    expect(body).toHaveProperty('refundAmount', 2.5);
  });

  it('should show full balance restored after cancellation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/billing/balance',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      balance: 100,
      frozen: 0,
      available: 100,
    });
  });
});

describe('Orders E2E — error cases', () => {
  let accessToken: string;
  let serviceId: string;

  beforeAll(async () => {
    const service = await seedService({
      name: 'YouTube Likes',
      platform: 'YOUTUBE',
      type: 'LIKES',
      pricePer1000: 5.0,
      minQuantity: 100,
      maxQuantity: 500000,
    });
    serviceId = service.id;
  });

  it('should reject order with insufficient funds', async () => {
    const poorUser = await registerAndLogin(app, {
      email: 'poor-user@example.com',
      username: 'poor_user',
    });
    accessToken = poorUser.accessToken;

    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: authHeaders(accessToken),
      payload: {
        serviceId,
        link: 'https://youtube.com/watch?v=poor-test',
        quantity: 1000,
      },
    });

    const body = JSON.parse(res.body);
    expect(body.error).toHaveProperty('code', 'INSUFFICIENT_FUNDS');
  });

  it('should reject order with non-existent service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: authHeaders(accessToken),
      payload: {
        serviceId: '00000000-0000-0000-0000-000000000000',
        link: 'https://youtube.com/watch?v=not-found',
        quantity: 1000,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toHaveProperty('code', 'SERVICE_NOT_FOUND');
  });

  it('should reject order with quantity below minimum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: authHeaders(accessToken),
      payload: {
        serviceId,
        link: 'https://youtube.com/watch?v=low-qty',
        quantity: 1,
      },
    });

    const body = JSON.parse(res.body);
    expect(body.error).toHaveProperty('code', 'INVALID_QUANTITY');
  });
});
