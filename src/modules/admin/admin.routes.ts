import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../../shared/errors';
import type { AdminDashboardService } from './admin-dashboard.service';
import type { AdminBillingService } from './admin-billing.service';
import type { AdminDepositsService } from './admin-deposits.service';
import type { AdminOrdersService } from './admin-orders.service';
import type { AdminServicesService } from './admin-services.service';
import type { AdminUsersService } from './admin-users.service';
import type { AdminOutboxService } from './admin-outbox.service';
import {
  adminUsersQuerySchema,
  adminUserIdSchema,
  adminUpdateUserSchema,
  adminBalanceAdjustSchema,
  adminOrdersQuerySchema,
  adminOrderIdSchema,
  adminForceStatusSchema,
  adminServicesQuerySchema,
  adminServiceCreateSchema,
  adminServiceUpdateSchema,
  adminServiceIdSchema,
  adminDepositsQuerySchema,
  adminDepositIdSchema,
} from './admin.types';

function validateBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

function validateQuery<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  query: unknown,
): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

function validateParams<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  params: unknown,
): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError('Validation failed', 'VALIDATION_ERROR', result.error?.issues);
  }
  return result.data as T;
}

export interface AdminRoutesDeps {
  dashboardService: AdminDashboardService;
  billingService: AdminBillingService;
  depositsService: AdminDepositsService;
  ordersService: AdminOrdersService;
  servicesService: AdminServicesService;
  usersService: AdminUsersService;
  outboxService: AdminOutboxService;
  authenticate: preHandlerAsyncHookHandler;
  requireAdmin: (req: FastifyRequest) => void | Promise<void>;
}

export function createAdminRoutes(deps: AdminRoutesDeps): FastifyPluginAsync {
  const {
    dashboardService,
    billingService,
    depositsService,
    ordersService,
    servicesService,
    usersService,
    outboxService,
    authenticate,
    requireAdmin,
  } = deps;

  return async (app) => {
    app.addHook('preHandler', authenticate);

    // Outbox observability
    app.get('/outbox', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const q = request.query as { limit?: string } | undefined;
      const parsedLimit = q?.limit != null ? Number.parseInt(q.limit, 10) : 50;
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 50;
      const result = await outboxService.getStats(limit);
      return reply.status(StatusCodes.OK).send(result);
    });

    // Users
    app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const query = validateQuery(adminUsersQuerySchema, request.query);
      const result = await usersService.listUsers(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminUserIdSchema, request.params);
      const result = await usersService.getUser(params.userId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.patch('/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminUserIdSchema, request.params);
      const body = validateBody(adminUpdateUserSchema, request.body);
      const result = await usersService.updateUser(params.userId, body);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post(
      '/users/:userId/balance/adjust',
      async (request: FastifyRequest, reply: FastifyReply) => {
        await requireAdmin(request);
        const params = validateParams(adminUserIdSchema, request.params);
        const body = validateBody(adminBalanceAdjustSchema, request.body);
        await billingService.adjustBalance(params.userId, body);
        return reply.status(StatusCodes.OK).send({ success: true });
      },
    );

    // Orders
    app.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const query = validateQuery(adminOrdersQuerySchema, request.query);
      const result = await ordersService.listAllOrders(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/orders/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminOrderIdSchema, request.params);
      const result = await ordersService.getAnyOrder(params.orderId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.patch('/orders/:orderId/status', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminOrderIdSchema, request.params);
      const body = validateBody(adminForceStatusSchema, request.body);
      const result = await ordersService.forceOrderStatus(params.orderId, body.status);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post('/orders/:orderId/refund', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminOrderIdSchema, request.params);
      const result = await ordersService.refundOrder(params.orderId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post(
      '/orders/:orderId/pause-drip-feed',
      async (request: FastifyRequest, reply: FastifyReply) => {
        await requireAdmin(request);
        const params = validateParams(adminOrderIdSchema, request.params);
        const result = await ordersService.pauseDripFeed(params.orderId);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    app.post(
      '/orders/:orderId/resume-drip-feed',
      async (request: FastifyRequest, reply: FastifyReply) => {
        await requireAdmin(request);
        const params = validateParams(adminOrderIdSchema, request.params);
        const result = await ordersService.resumeDripFeed(params.orderId);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    // Services
    app.get('/services', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const query = validateQuery(adminServicesQuerySchema, request.query);
      const result = await servicesService.listAllServices(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post('/services', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const body = validateBody(adminServiceCreateSchema, request.body);
      const result = await servicesService.createService(body);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.patch('/services/:serviceId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminServiceIdSchema, request.params);
      const body = validateBody(adminServiceUpdateSchema, request.body);
      const result = await servicesService.updateService(params.serviceId, body);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.delete('/services/:serviceId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(adminServiceIdSchema, request.params);
      await servicesService.deactivateService(params.serviceId);
      return reply.status(StatusCodes.NO_CONTENT).send();
    });

    // Deposits
    app.get('/deposits', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const query = validateQuery(adminDepositsQuerySchema, request.query);
      const result = await depositsService.listAllDeposits(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post(
      '/deposits/:depositId/confirm',
      async (request: FastifyRequest, reply: FastifyReply) => {
        await requireAdmin(request);
        const params = validateParams(adminDepositIdSchema, request.params);
        const result = await depositsService.adminConfirmDeposit(params.depositId);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    app.post(
      '/deposits/:depositId/expire',
      async (request: FastifyRequest, reply: FastifyReply) => {
        await requireAdmin(request);
        const params = validateParams(adminDepositIdSchema, request.params);
        const result = await depositsService.adminExpireDeposit(params.depositId);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    // Dashboard
    app.get('/dashboard/stats', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const result = await dashboardService.getDashboardStats();
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
