import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import * as billingService from './billing.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { depositSchema, transactionsQuerySchema, transactionIdSchema } from './billing.types';

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

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const result = await billingService.getBalance(user.userId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.post('/deposit', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const input = validateBody(depositSchema, request.body);
    const result = await billingService.createDeposit(user.userId, input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const query = validateQuery(transactionsQuerySchema, request.query);
    const result = await billingService.getTransactions(user.userId, query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/transactions/:transactionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(transactionIdSchema, request.params);
    const result = await billingService.getTransactionById(user.userId, params.transactionId);
    return reply.status(StatusCodes.OK).send(result);
  });
}
