import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import type { AuthenticatedUser } from '../auth';
import type { BillingService } from './billing.service';
import type { PaymentProviderRegistry } from './providers/registry';
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

export interface BillingRoutesDeps {
  service: BillingService;
  providerRegistry: PaymentProviderRegistry;
  authenticate: preHandlerAsyncHookHandler;
}

export function createBillingRoutes(deps: BillingRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  // providerRegistry reserved for future "list available providers" endpoint;
  // it's in deps to make the wiring explicit at app composition time.
  void deps.providerRegistry;

  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/balance', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const result = await service.getBalance(user.userId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const query = validateQuery(transactionsQuerySchema, request.query);
      const result = await service.getTransactions(user.userId, query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get(
      '/transactions/:transactionId',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = getAuthUser(request);
        const params = validateParams(transactionIdSchema, request.params);
        const result = await service.getTransactionById(user.userId, params.transactionId);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    app.get('/deposits', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const query = validateQuery(depositsQuerySchema, request.query);
      const result = await service.listDeposits(user.userId, query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/deposits/:depositId', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const params = validateParams(depositIdSchema, request.params);
      const result = await service.getDeposit(params.depositId, user.userId);
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
