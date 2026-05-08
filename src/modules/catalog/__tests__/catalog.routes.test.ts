import Fastify, { type FastifyInstance } from 'fastify';
import { createCatalogRoutes } from '../catalog.routes';
import type { CatalogService } from '../catalog.service';
import { AppError } from '../../../shared/errors/app-error';

function createFakeCatalogService(): CatalogService & {
  calls: { listServices: unknown[]; getService: string[] };
  responses: { listServices: unknown; getService: unknown };
  errors: { getService: Error | null };
} {
  const calls = { listServices: [] as unknown[], getService: [] as string[] };
  const responses: { listServices: unknown; getService: unknown } = {
    listServices: { services: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    getService: {},
  };
  const errors: { getService: Error | null } = { getService: null };

  return {
    async listServices(query) {
      calls.listServices.push(query);
      return responses.listServices as never;
    },
    async getService(serviceId) {
      calls.getService.push(serviceId);
      if (errors.getService) throw errors.getService;
      return responses.getService as never;
    },
    calls,
    responses,
    errors,
  };
}

const serviceResponse = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'High quality views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: 5.0,
  minQuantity: 100,
  maxQuantity: 100000,
};

const paginatedResponse = {
  services: [serviceResponse],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('Catalog Routes', () => {
  let app: FastifyInstance;
  let fakeService: ReturnType<typeof createFakeCatalogService>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });
    fakeService = createFakeCatalogService();
    await app.register(createCatalogRoutes(fakeService), { prefix: '/catalog' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakeService.calls.listServices.length = 0;
    fakeService.calls.getService.length = 0;
    fakeService.responses.listServices = paginatedResponse;
    fakeService.responses.getService = serviceResponse;
    fakeService.errors.getService = null;
  });

  describe('GET /catalog/services', () => {
    it('returns 200 with services list', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.services).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('passes default query params', async () => {
      await app.inject({ method: 'GET', url: '/catalog/services' });
      expect(fakeService.calls.listServices[0]).toMatchObject({ page: 1, limit: 20 });
    });

    it('passes platform filter', async () => {
      fakeService.responses.listServices = {
        services: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      await app.inject({ method: 'GET', url: '/catalog/services?platform=YOUTUBE' });
      expect(fakeService.calls.listServices[0]).toMatchObject({ platform: 'YOUTUBE' });
    });

    it('passes type filter', async () => {
      fakeService.responses.listServices = {
        services: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      await app.inject({ method: 'GET', url: '/catalog/services?type=VIEWS' });
      expect(fakeService.calls.listServices[0]).toMatchObject({ type: 'VIEWS' });
    });

    it('passes page and limit params', async () => {
      fakeService.responses.listServices = {
        services: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      };
      await app.inject({ method: 'GET', url: '/catalog/services?page=2&limit=10' });
      expect(fakeService.calls.listServices[0]).toMatchObject({ page: 2, limit: 10 });
    });

    it('returns 422 for invalid platform', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services?platform=INVALID' });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 for invalid type', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services?type=INVALID' });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 for page < 1', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services?page=0' });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 for limit > 100', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services?limit=200' });
      expect(res.statusCode).toBe(422);
    });

    it('does not require authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /catalog/services/:serviceId', () => {
    const serviceId = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 200 with service details', async () => {
      const res = await app.inject({ method: 'GET', url: `/catalog/services/${serviceId}` });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe('svc-1');
      expect(body.name).toBe('YouTube Views');
    });

    it('returns 404 when service not found', async () => {
      fakeService.errors.getService = new AppError('Service not found', {
        statusCode: 404,
        code: 'SERVICE_NOT_FOUND',
      });
      const res = await app.inject({ method: 'GET', url: `/catalog/services/${serviceId}` });
      expect(res.statusCode).toBe(404);
    });

    it('returns 422 for invalid UUID', async () => {
      const res = await app.inject({ method: 'GET', url: '/catalog/services/not-a-uuid' });
      expect(res.statusCode).toBe(422);
    });

    it('does not require authentication', async () => {
      const res = await app.inject({ method: 'GET', url: `/catalog/services/${serviceId}` });
      expect(res.statusCode).toBe(200);
    });
  });
});
