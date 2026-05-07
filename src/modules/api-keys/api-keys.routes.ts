import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from '../auth';
import * as apiKeysService from './api-keys.service';
import type { AuthenticatedUser } from '../auth';
import { createApiKeySchema, apiKeysQuerySchema, apiKeyIdSchema } from './api-keys.types';

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

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const input = validateBody(createApiKeySchema, request.body);
    const result = await apiKeysService.generateApiKey(user.userId, input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const query = validateQuery(apiKeysQuerySchema, request.query);
    const result = await apiKeysService.listApiKeys(user.userId, query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.delete('/:keyId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(apiKeyIdSchema, request.params);
    await apiKeysService.revokeApiKey(user.userId, params.keyId);
    return reply.status(StatusCodes.NO_CONTENT).send();
  });
}
