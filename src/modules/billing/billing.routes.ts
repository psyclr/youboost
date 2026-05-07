import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from '../auth';
import * as billingService from './billing.service';
import type { AuthenticatedUser } from '../auth';
import { transactionsQuerySchema, transactionIdSchema } from './billing.types';
import { depositIdSchema, depositsQuerySchema } from './deposit.types';

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

  app.get('/deposits', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const query = validateQuery(depositsQuerySchema, request.query);
    const result = await billingService.listDeposits(user.userId, query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/deposits/:depositId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(depositIdSchema, request.params);
    const result = await billingService.getDeposit(params.depositId, user.userId);
    return reply.status(StatusCodes.OK).send(result);
  });
}
