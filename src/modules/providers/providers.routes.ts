import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../../shared/errors';
import { authenticate } from '../auth';
import { requireAdmin } from './providers.middleware';
import * as providerService from './providers.service';
import {
  createProviderSchema,
  updateProviderSchema,
  providerIdSchema,
  providersQuerySchema,
} from './providers.types';

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

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const input = validateBody(createProviderSchema, request.body);
    const result = await providerService.createProvider(input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const query = validateQuery(providersQuerySchema, request.query);
    const result = await providerService.listProviders(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(providerIdSchema, request.params);
    const result = await providerService.getProvider(params.providerId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.put('/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(providerIdSchema, request.params);
    const input = validateBody(updateProviderSchema, request.body);
    const result = await providerService.updateProvider(params.providerId, input);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.delete('/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(providerIdSchema, request.params);
    await providerService.deactivateProvider(params.providerId);
    return reply.status(StatusCodes.NO_CONTENT).send();
  });

  app.get('/:providerId/services', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(providerIdSchema, request.params);
    const result = await providerService.fetchProviderServices(params.providerId);
    return reply.status(StatusCodes.OK).send({ services: result });
  });

  app.get('/:providerId/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    requireAdmin(request);
    const params = validateParams(providerIdSchema, request.params);
    const result = await providerService.checkProviderBalance(params.providerId);
    return reply.status(StatusCodes.OK).send(result);
  });
}
