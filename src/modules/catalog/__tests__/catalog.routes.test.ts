import Fastify, { type FastifyInstance } from 'fastify';
import { catalogRoutes } from '../catalog.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockListServices = jest.fn();
const mockGetService = jest.fn();

jest.mock('../catalog.service', () => ({
  listServices: (...args: unknown[]): unknown => mockListServices(...args),
  getService: (...args: unknown[]): unknown => mockGetService(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

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

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(catalogRoutes, { prefix: '/catalog' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /catalog/services', () => {
    it('should return 200 with services list', async () => {
      mockListServices.mockResolvedValue(paginatedResponse);

      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.services).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should pass default query params', async () => {
      mockListServices.mockResolvedValue(paginatedResponse);

      await app.inject({
        method: 'GET',
        url: '/catalog/services',
      });

      expect(mockListServices).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('should pass platform filter', async () => {
      mockListServices.mockResolvedValue({
        services: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await app.inject({
        method: 'GET',
        url: '/catalog/services?platform=YOUTUBE',
      });

      expect(mockListServices).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'YOUTUBE' }),
      );
    });

    it('should pass type filter', async () => {
      mockListServices.mockResolvedValue({
        services: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await app.inject({
        method: 'GET',
        url: '/catalog/services?type=VIEWS',
      });

      expect(mockListServices).toHaveBeenCalledWith(expect.objectContaining({ type: 'VIEWS' }));
    });

    it('should pass page and limit params', async () => {
      mockListServices.mockResolvedValue({
        services: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await app.inject({
        method: 'GET',
        url: '/catalog/services?page=2&limit=10',
      });

      expect(mockListServices).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });

    it('should return 422 for invalid platform', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services?platform=INVALID',
      });

      expect(res.statusCode).toBe(422);
    });

    it('should return 422 for invalid type', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services?type=INVALID',
      });

      expect(res.statusCode).toBe(422);
    });

    it('should return 422 for page < 1', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services?page=0',
      });

      expect(res.statusCode).toBe(422);
    });

    it('should return 422 for limit > 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services?limit=200',
      });

      expect(res.statusCode).toBe(422);
    });

    it('should not require authentication', async () => {
      mockListServices.mockResolvedValue(paginatedResponse);

      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services',
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /catalog/services/:serviceId', () => {
    const serviceId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 with service details', async () => {
      mockGetService.mockResolvedValue(serviceResponse);

      const res = await app.inject({
        method: 'GET',
        url: `/catalog/services/${serviceId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe('svc-1');
      expect(body.name).toBe('YouTube Views');
    });

    it('should return 404 when service not found', async () => {
      mockGetService.mockRejectedValue(
        new AppError('Service not found', { statusCode: 404, code: 'SERVICE_NOT_FOUND' }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/catalog/services/${serviceId}`,
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 422 for invalid UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/services/not-a-uuid',
      });

      expect(res.statusCode).toBe(422);
    });

    it('should not require authentication', async () => {
      mockGetService.mockResolvedValue(serviceResponse);

      const res = await app.inject({
        method: 'GET',
        url: `/catalog/services/${serviceId}`,
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
