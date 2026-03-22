import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import * as ordersService from './orders.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  createOrderSchema,
  ordersQuerySchema,
  orderIdSchema,
  bulkOrderSchema,
} from './orders.types';

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

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const input = validateBody(createOrderSchema, request.body);
    const result = await ordersService.createOrder(user.userId, input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.post('/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const input = validateBody(bulkOrderSchema, request.body);
    const result = await ordersService.createBulkOrders(user.userId, input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const query = validateQuery(ordersQuerySchema, request.query);
    const result = await ordersService.listOrders(user.userId, query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(orderIdSchema, request.params);
    const result = await ordersService.getOrder(user.userId, params.orderId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/:orderId/refill', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(orderIdSchema, request.params);
    const result = await ordersService.refillOrder(user.userId, params.orderId);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.delete('/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(orderIdSchema, request.params);
    const result = await ordersService.cancelOrder(user.userId, params.orderId);
    return reply.status(StatusCodes.OK).send(result);
  });
}
