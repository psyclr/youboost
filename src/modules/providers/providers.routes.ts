import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateBody, validateQuery, validateParams } from '../../shared/middleware/validation';
import type { ProvidersService } from './providers.service';
import {
  createProviderSchema,
  updateProviderSchema,
  providerIdSchema,
  providersQuerySchema,
} from './providers.types';

export interface ProviderRoutesDeps {
  service: ProvidersService;
  authenticate: preHandlerAsyncHookHandler;
  requireAdmin: (req: FastifyRequest) => void | Promise<void>;
}

export function createProviderRoutes(deps: ProviderRoutesDeps): FastifyPluginAsync {
  const { service, authenticate, requireAdmin } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const input = validateBody(createProviderSchema, request.body);
      const result = await service.createProvider(input);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const query = validateQuery(providersQuerySchema, request.query);
      const result = await service.listProviders(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(providerIdSchema, request.params);
      const result = await service.getProvider(params.providerId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.put('/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(providerIdSchema, request.params);
      const input = validateBody(updateProviderSchema, request.body);
      const result = await service.updateProvider(params.providerId, input);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.delete('/:providerId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(providerIdSchema, request.params);
      await service.deactivateProvider(params.providerId);
      return reply.status(StatusCodes.NO_CONTENT).send();
    });

    app.get('/:providerId/services', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(providerIdSchema, request.params);
      const result = await service.fetchProviderServices(params.providerId);
      return reply.status(StatusCodes.OK).send({ services: result });
    });

    app.get('/:providerId/balance', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(providerIdSchema, request.params);
      const result = await service.checkProviderBalance(params.providerId);
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
