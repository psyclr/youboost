import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../../shared/errors/app-error';
import { createAdminRoutes } from '../admin.routes';
import type { AdminDashboardService } from '../admin-dashboard.service';
import type { AdminBillingService } from '../admin-billing.service';
import type { AdminDepositsService } from '../admin-deposits.service';
import type { AdminOrdersService } from '../admin-orders.service';
import type { AdminServicesService } from '../admin-services.service';
import type { AdminUsersService } from '../admin-users.service';

function buildFakes(): {
  dashboardService: jest.Mocked<AdminDashboardService>;
  billingService: jest.Mocked<AdminBillingService>;
  depositsService: jest.Mocked<AdminDepositsService>;
  ordersService: jest.Mocked<AdminOrdersService>;
  servicesService: jest.Mocked<AdminServicesService>;
  usersService: jest.Mocked<AdminUsersService>;
} {
  return {
    dashboardService: {
      getDashboardStats: jest.fn(),
    } as unknown as jest.Mocked<AdminDashboardService>,
    billingService: { adjustBalance: jest.fn() } as unknown as jest.Mocked<AdminBillingService>,
    depositsService: {
      listAllDeposits: jest.fn(),
      adminConfirmDeposit: jest.fn(),
      adminExpireDeposit: jest.fn(),
    } as unknown as jest.Mocked<AdminDepositsService>,
    ordersService: {
      listAllOrders: jest.fn(),
      getAnyOrder: jest.fn(),
      forceOrderStatus: jest.fn(),
      refundOrder: jest.fn(),
      pauseDripFeed: jest.fn(),
      resumeDripFeed: jest.fn(),
    } as unknown as jest.Mocked<AdminOrdersService>,
    servicesService: {
      listAllServices: jest.fn(),
      createService: jest.fn(),
      updateService: jest.fn(),
      deactivateService: jest.fn(),
    } as unknown as jest.Mocked<AdminServicesService>,
    usersService: {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
    } as unknown as jest.Mocked<AdminUsersService>,
  };
}

const userId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const orderId = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';
const serviceId = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';
const depositId = 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a';
const paginatedRes = { pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

let app: FastifyInstance;
let fakes: ReturnType<typeof buildFakes>;

beforeAll(async () => {
  fakes = buildFakes();
  app = Fastify({ logger: false });
  app.setErrorHandler((error: Error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    return reply.status(500).send({ error: { message: error.message } });
  });

  const authenticate = async (req: FastifyRequest): Promise<void> => {
    (req as unknown as { user: { userId: string; role: string } }).user = {
      userId: 'admin-1',
      role: 'ADMIN',
    };
  };
  const requireAdmin = jest.fn();

  await app.register(createAdminRoutes({ ...fakes, authenticate, requireAdmin }), {
    prefix: '/admin',
  });
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Admin Routes (factory)', () => {
  describe('GET /admin/users', () => {
    it('should return users list', async () => {
      fakes.usersService.listUsers.mockResolvedValue({ users: [], ...paginatedRes });
      const res = await app.inject({ method: 'GET', url: '/admin/users' });
      expect(res.statusCode).toBe(200);
      expect(fakes.usersService.listUsers).toHaveBeenCalled();
    });
  });

  describe('GET /admin/users/:userId', () => {
    it('should return user detail', async () => {
      fakes.usersService.getUser.mockResolvedValue({
        userId,
        email: 'a@b.com',
        wallet: null,
      } as Awaited<ReturnType<AdminUsersService['getUser']>>);
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
      fakes.usersService.updateUser.mockResolvedValue({
        userId,
        role: 'ADMIN',
        status: 'ACTIVE',
      } as Awaited<ReturnType<AdminUsersService['updateUser']>>);
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
      fakes.billingService.adjustBalance.mockResolvedValue(undefined);
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
      fakes.ordersService.listAllOrders.mockResolvedValue({ orders: [], ...paginatedRes });
      const res = await app.inject({ method: 'GET', url: '/admin/orders' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /admin/orders/:orderId', () => {
    it('should return order detail', async () => {
      fakes.ordersService.getAnyOrder.mockResolvedValue({
        orderId,
        status: 'PENDING',
      } as Awaited<ReturnType<AdminOrdersService['getAnyOrder']>>);
      const res = await app.inject({ method: 'GET', url: `/admin/orders/${orderId}` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /admin/orders/:orderId/status', () => {
    it('should force order status', async () => {
      fakes.ordersService.forceOrderStatus.mockResolvedValue({
        orderId,
        status: 'COMPLETED',
      } as Awaited<ReturnType<AdminOrdersService['forceOrderStatus']>>);
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
      fakes.ordersService.refundOrder.mockResolvedValue({
        orderId,
        status: 'REFUNDED',
      } as Awaited<ReturnType<AdminOrdersService['refundOrder']>>);
      const res = await app.inject({ method: 'POST', url: `/admin/orders/${orderId}/refund` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /admin/services', () => {
    it('should return services list', async () => {
      fakes.servicesService.listAllServices.mockResolvedValue({
        services: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      const res = await app.inject({ method: 'GET', url: '/admin/services' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /admin/services', () => {
    it('should create service', async () => {
      fakes.servicesService.createService.mockResolvedValue({
        serviceId,
        name: 'Test',
      } as Awaited<ReturnType<AdminServicesService['createService']>>);
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
      fakes.servicesService.updateService.mockResolvedValue({
        serviceId,
        name: 'Updated',
      } as Awaited<ReturnType<AdminServicesService['updateService']>>);
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
      fakes.servicesService.deactivateService.mockResolvedValue(undefined);
      const res = await app.inject({ method: 'DELETE', url: `/admin/services/${serviceId}` });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('GET /admin/deposits', () => {
    it('should return deposits list', async () => {
      fakes.depositsService.listAllDeposits.mockResolvedValue({
        deposits: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      const res = await app.inject({ method: 'GET', url: '/admin/deposits' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /admin/deposits/:depositId/confirm', () => {
    it('should confirm deposit', async () => {
      fakes.depositsService.adminConfirmDeposit.mockResolvedValue({
        id: depositId,
        status: 'CONFIRMED',
      } as Awaited<ReturnType<AdminDepositsService['adminConfirmDeposit']>>);
      const res = await app.inject({
        method: 'POST',
        url: `/admin/deposits/${depositId}/confirm`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /admin/deposits/:depositId/expire', () => {
    it('should expire deposit', async () => {
      fakes.depositsService.adminExpireDeposit.mockResolvedValue({
        id: depositId,
        status: 'EXPIRED',
      } as Awaited<ReturnType<AdminDepositsService['adminExpireDeposit']>>);
      const res = await app.inject({
        method: 'POST',
        url: `/admin/deposits/${depositId}/expire`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /admin/dashboard/stats', () => {
    it('should return dashboard stats', async () => {
      fakes.dashboardService.getDashboardStats.mockResolvedValue({
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
