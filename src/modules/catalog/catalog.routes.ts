import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../../shared/errors';
import * as catalogService from './catalog.service';
import { catalogQuerySchema, catalogServiceIdSchema } from './catalog.types';

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

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/services', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = validateQuery(catalogQuerySchema, request.query);
    const result = await catalogService.listServices(query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/services/:serviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = validateParams(catalogServiceIdSchema, request.params);
    const result = await catalogService.getService(params.serviceId);
    return reply.status(StatusCodes.OK).send(result);
  });
}
