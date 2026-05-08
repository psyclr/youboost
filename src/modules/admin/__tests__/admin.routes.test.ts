import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../../shared/errors/app-error';
import { adminRoutes } from '../admin.routes';

const mockListUsers = jest.fn();
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockListAllOrders = jest.fn();
const mockGetAnyOrder = jest.fn();
const mockForceOrderStatus = jest.fn();
const mockRefundOrder = jest.fn();
const mockListAllServices = jest.fn();
const mockCreateService = jest.fn();
const mockUpdateService = jest.fn();
const mockDeactivateService = jest.fn();
const mockAdjustBalance = jest.fn();
const mockGetDashboardStats = jest.fn();

jest.mock('../admin-users.service', () => ({
  listUsers: (...args: unknown[]): unknown => mockListUsers(...args),
  getUser: (...args: unknown[]): unknown => mockGetUser(...args),
  updateUser: (...args: unknown[]): unknown => mockUpdateUser(...args),
}));
jest.mock('../admin-orders.service', () => ({
  listAllOrders: (...args: unknown[]): unknown => mockListAllOrders(...args),
  getAnyOrder: (...args: unknown[]): unknown => mockGetAnyOrder(...args),
  forceOrderStatus: (...args: unknown[]): unknown => mockForceOrderStatus(...args),
  refundOrder: (...args: unknown[]): unknown => mockRefundOrder(...args),
}));
jest.mock('../admin-services.service', () => ({
  listAllServices: (...args: unknown[]): unknown => mockListAllServices(...args),
  createService: (...args: unknown[]): unknown => mockCreateService(...args),
  updateService: (...args: unknown[]): unknown => mockUpdateService(...args),
  deactivateService: (...args: unknown[]): unknown => mockDeactivateService(...args),
}));
jest.mock('../admin-billing.service', () => ({
  adjustBalance: (...args: unknown[]): unknown => mockAdjustBalance(...args),
}));
jest.mock('../admin-dashboard.service', () => ({
  getDashboardStats: (...args: unknown[]): unknown => mockGetDashboardStats(...args),
}));
jest.mock('../../auth/auth.middleware', () => ({
  authenticate: jest.fn().mockImplementation(async (req: unknown) => {
    (req as Record<string, unknown>).user = { userId: 'admin-1', role: 'ADMIN' };
  }),
  // `auth/index.ts` imports `createAuthenticate` to build the transitional
  // `authenticate` shim used by unconverted callers (admin.routes). Provide
  // a stub that returns the same bypass function above.
  createAuthenticate: jest.fn().mockImplementation(() => async (req: unknown) => {
    (req as Record<string, unknown>).user = { userId: 'admin-1', role: 'ADMIN' };
  }),
}));
jest.mock('../../providers/providers.middleware', () => ({
  requireAdmin: jest.fn(),
}));

const userId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const orderId = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';
const serviceId = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';
const paginatedRes = { pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    return reply.status(500).send({ error: { message: (error as Error).message } });
  });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Admin Routes', () => {
  describe('GET /admin/users', () => {
    it('should return users list', async () => {
      mockListUsers.mockResolvedValue({ users: [], ...paginatedRes });
      const res = await app.inject({ method: 'GET', url: '/admin/users' });
      expect(res.statusCode).toBe(200);
      expect(mockListUsers).toHaveBeenCalled();
    });
  });

  describe('GET /admin/users/:userId', () => {
    it('should return user detail', async () => {
      mockGetUser.mockResolvedValue({ userId, email: 'a@b.com', wallet: null });
      const res = await app.inject({ method: 'GET', url: `/admin/users/${userId}` });
      expect(res.statusCode).toBe(200);
    });

    it('should reject invalid uuid', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/users/bad' });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('PATCH /admin/users/:userId', () => {
    it('should update user', async () => {
      mockUpdateUser.mockResolvedValue({ userId, role: 'ADMIN', status: 'ACTIVE' });
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/users/${userId}`,
        payload: { role: 'ADMIN' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /admin/users/:userId/balance/adjust', () => {
    it('should adjust balance', async () => {
      mockAdjustBalance.mockResolvedValue(undefined);
      const res = await app.inject({
        method: 'POST',
        url: `/admin/users/${userId}/balance/adjust`,
        payload: { amount: 100, reason: 'Bonus' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should reject missing reason', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/users/${userId}/balance/adjust`,
        payload: { amount: 100 },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /admin/orders', () => {
    it('should return orders list', async () => {
      mockListAllOrders.mockResolvedValue({ orders: [], ...paginatedRes });
      const res = await app.inject({ method: 'GET', url: '/admin/orders' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /admin/orders/:orderId', () => {
    it('should return order detail', async () => {
      mockGetAnyOrder.mockResolvedValue({ orderId, status: 'PENDING' });
      const res = await app.inject({ method: 'GET', url: `/admin/orders/${orderId}` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /admin/orders/:orderId/status', () => {
    it('should force order status', async () => {
      mockForceOrderStatus.mockResolvedValue({ orderId, status: 'COMPLETED' });
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/orders/${orderId}/status`,
        payload: { status: 'COMPLETED' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should reject invalid status', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/orders/${orderId}/status`,
        payload: { status: 'INVALID' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /admin/orders/:orderId/refund', () => {
    it('should refund order', async () => {
      mockRefundOrder.mockResolvedValue({ orderId, status: 'REFUNDED' });
      const res = await app.inject({ method: 'POST', url: `/admin/orders/${orderId}/refund` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /admin/services', () => {
    it('should return services list', async () => {
      mockListAllServices.mockResolvedValue({ services: [] });
      const res = await app.inject({ method: 'GET', url: '/admin/services' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /admin/services', () => {
    it('should create service', async () => {
      mockCreateService.mockResolvedValue({ serviceId, name: 'Test' });
      const res = await app.inject({
        method: 'POST',
        url: '/admin/services',
        payload: {
          name: 'Test',
          platform: 'YOUTUBE',
          type: 'VIEWS',
          pricePer1000: 2.5,
          minQuantity: 100,
          maxQuantity: 100000,
          providerId: 'a0000000-0000-4000-a000-000000000001',
          externalServiceId: '101',
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('should reject missing required fields', async () => {
      const res = await app.inject({ method: 'POST', url: '/admin/services', payload: {} });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('PATCH /admin/services/:serviceId', () => {
    it('should update service', async () => {
      mockUpdateService.mockResolvedValue({ serviceId, name: 'Updated' });
      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/services/${serviceId}`,
        payload: { name: 'Updated' },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /admin/services/:serviceId', () => {
    it('should deactivate service', async () => {
      mockDeactivateService.mockResolvedValue(undefined);
      const res = await app.inject({ method: 'DELETE', url: `/admin/services/${serviceId}` });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('GET /admin/dashboard/stats', () => {
    it('should return dashboard stats', async () => {
      mockGetDashboardStats.mockResolvedValue({
        totalUsers: 10,
        totalOrders: 50,
        totalRevenue: 500,
        activeServices: 5,
        recentOrders: [],
      });
      const res = await app.inject({ method: 'GET', url: '/admin/dashboard/stats' });
      expect(res.statusCode).toBe(200);
    });
  });
});
