import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateQuery, validateParams } from '../../shared/middleware/validation';
import type { CatalogService } from './catalog.service';
import { catalogQuerySchema, catalogServiceIdSchema } from './catalog.types';

export function createCatalogRoutes(service: CatalogService): FastifyPluginAsync {
  return async (app) => {
    app.get('/services', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = validateQuery(catalogQuerySchema, request.query);
      const result = await service.listServices(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/services/:serviceId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = validateParams(catalogServiceIdSchema, request.params);
      const result = await service.getService(params.serviceId);
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
