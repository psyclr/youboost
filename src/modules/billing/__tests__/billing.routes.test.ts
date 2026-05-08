import Fastify, { type FastifyInstance } from 'fastify';
import { createBillingRoutes } from '../billing.routes';
import { AppError, UnauthorizedError } from '../../../shared/errors';
import type { BillingService } from '../billing.service';
import type { PaymentProviderRegistry } from '../providers/registry';
import type { AuthenticatedUser } from '../../auth';

function makeService(): jest.Mocked<BillingService> {
  return {
    getBalance: jest.fn(),
    listDeposits: jest.fn(),
    getDeposit: jest.fn(),
    getTransactions: jest.fn(),
    getTransactionById: jest.fn(),
  };
}

function makeRegistry(): PaymentProviderRegistry {
  return {
    getAll: jest.fn().mockReturnValue([]),
    get: jest.fn(),
  };
}

const validUser: AuthenticatedUser = {
  userId: 'u1',
  email: 'a@b.com',
  role: 'USER',
  jti: 'jti-1',
};

describe('Billing Routes', () => {
  let app: FastifyInstance;
  let service: jest.Mocked<BillingService>;

  beforeAll(async () => {
    service = makeService();
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    const authenticate = async function (
      this: unknown,
      req: { headers: Record<string, unknown>; user?: AuthenticatedUser },
    ): Promise<void> {
      const token = req.headers['authorization'];
      if (token !== 'Bearer valid-token') {
        throw new UnauthorizedError('Missing auth', 'MISSING_AUTH');
      }
      req.user = validUser;
    } as never;

    const registry = makeRegistry();
    await app.register(
      createBillingRoutes({
        service,
        providerRegistry: registry,
        authenticate,
      }),
      { prefix: '/billing' },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Keep authenticate behavior; only clear service/registry mocks.
  });

  const authHeaders = { authorization: 'Bearer valid-token' };

  describe('GET /billing/balance', () => {
    it('should return 200 with balance', async () => {
      service.getBalance.mockResolvedValue({
        userId: 'u1',
        balance: 100,
        frozen: 10,
        available: 90,
        currency: 'USD',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/billing/balance',
        headers: authHeaders,
      });

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
      service.getTransactions.mockResolvedValue({
        transactions: [
          { id: 't1', type: 'DEPOSIT', amount: 50, description: null, createdAt: new Date() },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/billing/transactions',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.transactions).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      service.getTransactions.mockResolvedValue({
        transactions: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await app.inject({
        method: 'GET',
        url: '/billing/transactions?page=2&limit=10&type=HOLD',
        headers: authHeaders,
      });

      expect(service.getTransactions).toHaveBeenCalledWith('u1', {
        page: 2,
        limit: 10,
        type: 'HOLD',
      });
    });

    it('should return 422 on invalid query params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/billing/transactions?page=0',
        headers: authHeaders,
      });
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
      service.getTransactionById.mockResolvedValue({
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
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(txId);
    });

    it('should return 422 on invalid UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/billing/transactions/not-a-uuid',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: `/billing/transactions/${txId}` });
      expect(res.statusCode).toBe(401);
    });
  });
});
