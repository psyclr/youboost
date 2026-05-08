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
import type { ApiKeysService } from './api-keys.service';
import { createApiKeySchema, apiKeysQuerySchema, apiKeyIdSchema } from './api-keys.types';

export interface ApiKeyRoutesDeps {
  service: ApiKeysService;
  authenticate: preHandlerAsyncHookHandler;
}

function getAuthUser(request: FastifyRequest): AuthenticatedUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'MISSING_USER');
  }
  return user;
}

export function createApiKeyRoutes(deps: ApiKeyRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const input = validateBody(createApiKeySchema, request.body);
      const result = await service.createApiKey(user.userId, input);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const query = validateQuery(apiKeysQuerySchema, request.query);
      const result = await service.listApiKeys(user.userId, query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.delete('/:keyId', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      const params = validateParams(apiKeyIdSchema, request.params);
      await service.revokeApiKey(user.userId, params.keyId);
      return reply.status(StatusCodes.NO_CONTENT).send();
    });
  };
}
