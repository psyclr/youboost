import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import { requireAdmin } from '../providers/providers.middleware';
import * as adminUsersService from './admin-users.service';
import * as adminOrdersService from './admin-orders.service';
import * as adminServicesService from './admin-services.service';
import * as adminBillingService from './admin-billing.service';
import * as adminDashboardService from './admin-dashboard.service';
import * as adminDepositsService from './admin-deposits.service';
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

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // Users
  app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const query = validateQuery(adminUsersQuerySchema, request.query);
    const result = await adminUsersService.listUsers(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminUserIdSchema, request.params);
    const result = await adminUsersService.getUser(params.userId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.patch('/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminUserIdSchema, request.params);
    const body = validateBody(adminUpdateUserSchema, request.body);
    const result = await adminUsersService.updateUser(params.userId, body);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post(
    '/users/:userId/balance/adjust',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAdmin(request);
      const params = validateParams(adminUserIdSchema, request.params);
      const body = validateBody(adminBalanceAdjustSchema, request.body);
      await adminBillingService.adjustBalance(params.userId, body);
      return reply.status(StatusCodes.OK).send({ success: true });
    },
  );

  // Orders
  app.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const query = validateQuery(adminOrdersQuerySchema, request.query);
    const result = await adminOrdersService.listAllOrders(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/orders/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminOrderIdSchema, request.params);
    const result = await adminOrdersService.getAnyOrder(params.orderId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.patch('/orders/:orderId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminOrderIdSchema, request.params);
    const body = validateBody(adminForceStatusSchema, request.body);
    const result = await adminOrdersService.forceOrderStatus(params.orderId, body.status);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/orders/:orderId/refund', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminOrderIdSchema, request.params);
    const result = await adminOrdersService.refundOrder(params.orderId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post(
    '/orders/:orderId/pause-drip-feed',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAdmin(request);
      const params = validateParams(adminOrderIdSchema, request.params);
      const result = await adminOrdersService.pauseDripFeed(params.orderId);
      return reply.status(StatusCodes.OK).send(result);
    },
  );

  app.post(
    '/orders/:orderId/resume-drip-feed',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAdmin(request);
      const params = validateParams(adminOrderIdSchema, request.params);
      const result = await adminOrdersService.resumeDripFeed(params.orderId);
      return reply.status(StatusCodes.OK).send(result);
    },
  );

  // Services
  app.get('/services', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const query = validateQuery(adminServicesQuerySchema, request.query);
    const result = await adminServicesService.listAllServices(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/services', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const body = validateBody(adminServiceCreateSchema, request.body);
    const result = await adminServicesService.createService(body);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.patch('/services/:serviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminServiceIdSchema, request.params);
    const body = validateBody(adminServiceUpdateSchema, request.body);
    const result = await adminServicesService.updateService(params.serviceId, body);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.delete('/services/:serviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminServiceIdSchema, request.params);
    await adminServicesService.deactivateService(params.serviceId);
    return reply.status(StatusCodes.NO_CONTENT).send();
  });

  // Deposits
  app.get('/deposits', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const query = validateQuery(adminDepositsQuerySchema, request.query);
    const result = await adminDepositsService.listAllDeposits(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/deposits/:depositId/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminDepositIdSchema, request.params);
    const result = await adminDepositsService.adminConfirmDeposit(params.depositId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/deposits/:depositId/expire', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(adminDepositIdSchema, request.params);
    const result = await adminDepositsService.adminExpireDeposit(params.depositId);
    return reply.status(StatusCodes.OK).send(result);
  });

  // Dashboard
  app.get('/dashboard/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const result = await adminDashboardService.getDashboardStats();
    return reply.status(StatusCodes.OK).send(result);
  });
}
