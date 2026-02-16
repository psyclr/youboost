import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { authenticate } from '../auth/auth.middleware';
import * as webhooksService from './webhooks.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhooksQuerySchema,
  webhookIdSchema,
} from './webhooks.types';

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

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const input = validateBody(createWebhookSchema, request.body);
    const result = await webhooksService.createWebhook(user.userId, input);
    return reply.status(StatusCodes.CREATED).send(result);
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const query = validateQuery(webhooksQuerySchema, request.query);
    const result = await webhooksService.listWebhooks(user.userId, query);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.get('/:webhookId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(webhookIdSchema, request.params);
    const result = await webhooksService.getWebhook(user.userId, params.webhookId);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.put('/:webhookId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(webhookIdSchema, request.params);
    const input = validateBody(updateWebhookSchema, request.body);
    const result = await webhooksService.updateWebhook(user.userId, params.webhookId, input);
    return reply.status(StatusCodes.OK).send(result);
  });

  app.delete('/:webhookId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);
    const params = validateParams(webhookIdSchema, request.params);
    await webhooksService.deleteWebhook(user.userId, params.webhookId);
    return reply.status(StatusCodes.NO_CONTENT).send();
  });
}
