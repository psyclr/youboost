import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError } from '../../shared/errors';
import { validateBody, validateQuery, validateParams } from '../../shared/middleware/validation';
import type { AuthenticatedUser } from '../auth';
import type { WebhooksService } from './webhooks.service';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhooksQuerySchema,
  webhookIdSchema,
} from './webhooks.types';

export interface WebhookRoutesDeps {
  service: WebhooksService;
  authenticate: preHandlerAsyncHookHandler;
}

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export function createWebhookRoutes(deps: WebhookRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const input = validateBody(createWebhookSchema, request.body);
      const result = await service.createWebhook(user.userId, input);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const query = validateQuery(webhooksQuerySchema, request.query);
      const result = await service.listWebhooks(user.userId, query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/:webhookId', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const params = validateParams(webhookIdSchema, request.params);
      const result = await service.getWebhook(user.userId, params.webhookId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.put('/:webhookId', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const params = validateParams(webhookIdSchema, request.params);
      const input = validateBody(updateWebhookSchema, request.body);
      const result = await service.updateWebhook(user.userId, params.webhookId, input);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.delete('/:webhookId', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const params = validateParams(webhookIdSchema, request.params);
      await service.deleteWebhook(user.userId, params.webhookId);
      return reply.status(StatusCodes.NO_CONTENT).send();
    });
  };
}
