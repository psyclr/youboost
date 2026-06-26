import type { FastifyInstance } from 'fastify';
import type { SitesService } from './sites.service';
import {
  CreateSiteSchema,
  UpdateSiteSchema,
  ConnectDomainSchema,
} from './sites.types';

export function createSitesRoutes(sitesService: SitesService) {
  return async function (app: FastifyInstance) {
    app.post('/', async (req, reply) => {
      const input = CreateSiteSchema.parse(req.body);
      const site = await sitesService.create(input);
      return reply.status(201).send(site);
    });

    app.get('/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const site = await sitesService.getById(id);
      return reply.send(site);
    });

    app.patch('/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = UpdateSiteSchema.parse(req.body);
      const site = await sitesService.update(id, input);
      return reply.send(site);
    });

    app.post('/:id/connect-domain', async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = ConnectDomainSchema.parse(req.body);
      const site = await sitesService.connectDomain(id, input);
      return reply.send(site);
    });

    app.get('/:id/dns-status', async (req, reply) => {
      const { id } = req.params as { id: string };
      const status = await sitesService.checkDomainStatus(id);
      return reply.send(status);
    });
  };
}
