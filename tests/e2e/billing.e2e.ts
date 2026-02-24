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

describe('Billing E2E', () => {
  let accessToken: string;
  let depositId: string;
  let transactionId: string;

  it('should register and login', async () => {
    const result = await registerAndLogin(app, {
      email: 'billing-test@example.com',
      username: 'billing_test_user',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.userId).toBeDefined();

    accessToken = result.accessToken;
  });

  it('should return zero balance for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/billing/balance',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      balance: 0,
      frozen: 0,
      available: 0,
      currency: 'USD',
    });
  });

  it('should create a deposit', async () => {
    const res = await app.inject({
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

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('depositId');
    expect(body).toHaveProperty('paymentAddress');
    expect(body).toHaveProperty('status', 'pending');

    depositId = body.depositId as string;
  });

  it('should list deposits with one pending deposit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/billing/deposits',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deposits).toHaveLength(1);
    expect(body.deposits[0]).toHaveProperty('status', 'PENDING');
  });

  it('should confirm the deposit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/billing/deposits/${depositId}/confirm`,
      headers: authHeaders(accessToken),
      payload: { txHash: '0xabc123test' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('status', 'CONFIRMED');
  });

  it('should show updated balance after deposit confirmation', async () => {
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

  it('should list transactions with one deposit entry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/billing/transactions',
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]).toHaveProperty('type', 'DEPOSIT');

    transactionId = body.transactions[0].id as string;
  });

  it('should return transaction detail with balance before and after', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/billing/transactions/${transactionId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('balanceBefore', 0);
    expect(body).toHaveProperty('balanceAfter', 100);
  });

  it('should return confirmed deposit detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/billing/deposits/${depositId}`,
      headers: authHeaders(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('status', 'CONFIRMED');
    expect(body).toHaveProperty('txHash', '0xabc123test');
    expect(body).toHaveProperty('amount', 100);
  });
});
