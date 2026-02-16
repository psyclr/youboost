import Fastify, { type FastifyInstance } from 'fastify';
import { orderRoutes } from '../orders.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockCreateOrder = jest.fn();
const mockGetOrder = jest.fn();
const mockListOrders = jest.fn();
const mockCancelOrder = jest.fn();

jest.mock('../orders.service', () => ({
  createOrder: (...args: unknown[]): unknown => mockCreateOrder(...args),
  getOrder: (...args: unknown[]): unknown => mockGetOrder(...args),
  listOrders: (...args: unknown[]): unknown => mockListOrders(...args),
  cancelOrder: (...args: unknown[]): unknown => mockCancelOrder(...args),
}));

const mockVerifyAccessToken = jest.fn();
const mockIsBlacklisted = jest.fn();

jest.mock('../../auth/utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
}));

jest.mock('../../auth/token-store', () => ({
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

describe('Order Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(orderRoutes, { prefix: '/orders' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /orders', () => {
    const validOrder = {
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
      link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      quantity: 1000,
    };

    it('should return 201 on valid order', async () => {
      const headers = withAuth();
      mockCreateOrder.mockResolvedValue({
        orderId: 'o1',
        serviceId: validOrder.serviceId,
        status: 'PROCESSING',
        quantity: 1000,
        completed: 0,
        price: 2.5,
        createdAt: new Date(),
        link: validOrder.link,
        startCount: null,
        remains: 1000,
        updatedAt: new Date(),
        comments: null,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        headers,
        payload: validOrder,
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).orderId).toBe('o1');
    });

    it('should return 422 on invalid serviceId', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        headers,
        payload: { ...validOrder, serviceId: 'not-a-uuid' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 on invalid link', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        headers,
        payload: { ...validOrder, link: 'not-a-url' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 on zero quantity', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        headers,
        payload: { ...validOrder, quantity: 0 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'POST', url: '/orders', payload: validOrder });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /orders', () => {
    it('should return 200 with paginated orders', async () => {
      const headers = withAuth();
      mockListOrders.mockResolvedValue({
        orders: [
          {
            orderId: 'o1',
            serviceId: 's1',
            status: 'PENDING',
            quantity: 100,
            completed: 0,
            price: 1,
            createdAt: new Date(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await app.inject({ method: 'GET', url: '/orders', headers });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.orders).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      const headers = withAuth();
      mockListOrders.mockResolvedValue({
        orders: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await app.inject({ method: 'GET', url: '/orders?page=2&limit=10&status=PENDING', headers });

      expect(mockListOrders).toHaveBeenCalledWith('u1', { page: 2, limit: 10, status: 'PENDING' });
    });

    it('should return 422 on invalid query params', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'GET', url: '/orders?page=0', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/orders' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /orders/:orderId', () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 with order detail', async () => {
      const headers = withAuth();
      mockGetOrder.mockResolvedValue({
        orderId,
        serviceId: 's1',
        status: 'PROCESSING',
        quantity: 1000,
        completed: 0,
        price: 2.5,
        createdAt: new Date(),
        link: 'https://yt.com',
        startCount: null,
        remains: 1000,
        updatedAt: new Date(),
        comments: null,
      });

      const res = await app.inject({ method: 'GET', url: `/orders/${orderId}`, headers });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).orderId).toBe(orderId);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'GET', url: '/orders/not-a-uuid', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: `/orders/${orderId}` });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /orders/:orderId', () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 on successful cancel', async () => {
      const headers = withAuth();
      mockCancelOrder.mockResolvedValue({
        orderId,
        status: 'CANCELLED',
        refundAmount: 2.5,
        cancelledAt: new Date(),
      });

      const res = await app.inject({ method: 'DELETE', url: `/orders/${orderId}`, headers });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('CANCELLED');
      expect(body.refundAmount).toBe(2.5);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'DELETE', url: '/orders/not-a-uuid', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/orders/${orderId}` });
      expect(res.statusCode).toBe(401);
    });
  });
});
