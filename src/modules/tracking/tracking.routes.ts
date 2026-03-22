import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import { requireAdmin } from '../providers/providers.middleware';
import * as trackingService from './tracking.service';
import { createTrackingLinkSchema, trackingLinkIdSchema } from './tracking.types';

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

export async function adminTrackingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createTrackingLinkSchema, request.body);
    const result = await trackingService.createTrackingLink(body);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await trackingService.listTrackingLinks();
    return reply.status(StatusCodes.OK).send(result);
  });

  app.delete('/:linkId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = validateParams(trackingLinkIdSchema, request.params);
    await trackingService.deleteTrackingLink(params.linkId);
    return reply.status(StatusCodes.NO_CONTENT).send();
  });
}
