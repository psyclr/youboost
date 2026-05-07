import Fastify, { type FastifyInstance } from 'fastify';
import { billingRoutes } from '../billing.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockGetBalance = jest.fn();
const mockGetTransactions = jest.fn();
const mockGetTransactionById = jest.fn();
const mockListDeposits = jest.fn();
const mockGetDeposit = jest.fn();

jest.mock('../billing.service', () => ({
  getBalance: (...args: unknown[]): unknown => mockGetBalance(...args),
  getTransactions: (...args: unknown[]): unknown => mockGetTransactions(...args),
  getTransactionById: (...args: unknown[]): unknown => mockGetTransactionById(...args),
  listDeposits: (...args: unknown[]): unknown => mockListDeposits(...args),
  getDeposit: (...args: unknown[]): unknown => mockGetDeposit(...args),
}));

const mockVerifyAccessToken = jest.fn();
const mockIsBlacklisted = jest.fn();

jest.mock('../../auth/utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
}));

jest.mock('../../auth/token.repository', () => ({
  isAccessTokenBlacklisted: (...args: unknown[]): unknown => mockIsBlacklisted(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const validUser = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-1' };

function withAuth(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(validUser);
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer valid-token' };
}

describe('Billing Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(billingRoutes, { prefix: '/billing' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /billing/balance', () => {
    it('should return 200 with balance', async () => {
      const headers = withAuth();
      mockGetBalance.mockResolvedValue({
        userId: 'u1',
        balance: 100,
        frozen: 10,
        available: 90,
        currency: 'USD',
      });

      const res = await app.inject({ method: 'GET', url: '/billing/balance', headers });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.balance).toBe(100);
      expect(body.available).toBe(90);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/billing/balance' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /billing/transactions', () => {
    it('should return 200 with paginated transactions', async () => {
      const headers = withAuth();
      mockGetTransactions.mockResolvedValue({
        transactions: [
          { id: 't1', type: 'DEPOSIT', amount: 50, description: null, createdAt: new Date() },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await app.inject({ method: 'GET', url: '/billing/transactions', headers });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.transactions).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      const headers = withAuth();
      mockGetTransactions.mockResolvedValue({
        transactions: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await app.inject({
        method: 'GET',
        url: '/billing/transactions?page=2&limit=10&type=HOLD',
        headers,
      });

      expect(mockGetTransactions).toHaveBeenCalledWith('u1', { page: 2, limit: 10, type: 'HOLD' });
    });

    it('should return 422 on invalid query params', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'GET', url: '/billing/transactions?page=0', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/billing/transactions' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /billing/transactions/:transactionId', () => {
    const txId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 with transaction detail', async () => {
      const headers = withAuth();
      mockGetTransactionById.mockResolvedValue({
        id: txId,
        type: 'DEPOSIT',
        amount: 50,
        description: null,
        createdAt: new Date(),
        balanceBefore: 0,
        balanceAfter: 50,
        metadata: null,
        referenceType: null,
        referenceId: null,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/billing/transactions/${txId}`,
        headers,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(txId);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'GET',
        url: '/billing/transactions/not-a-uuid',
        headers,
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: `/billing/transactions/${txId}` });
      expect(res.statusCode).toBe(401);
    });
  });
});
