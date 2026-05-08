import { createApp } from './app';
import { AppError } from './shared/errors/app-error';
import type { FastifyInstance } from 'fastify';

jest.mock('./shared/health/health', () => ({
  checkHealth: jest.fn().mockResolvedValue({
    status: 'ok',
    checks: {
      database: true,
      redis: true,
      memory: { rss: 1000, heapUsed: 500, heapTotal: 2000 },
    },
    uptime: 123,
    timestamp: '2025-01-01T00:00:00.000Z',
  }),
}));

jest.mock('./shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  createRequestLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('App Factory', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;

    app.get('/test/app-error', async () => {
      throw new AppError('Test error', {
        statusCode: 400,
        code: 'TEST_ERROR',
        details: { test: true },
      });
    });

    app.get('/test/generic-error', async () => {
      throw new Error('Unexpected error');
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.checks).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('youboost-api');
      expect(body.version).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should handle AppError with correct status and body', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/app-error',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('TEST_ERROR');
      expect(body.error.message).toBe('Test error');
      expect(body.error.details).toEqual({ test: true });
    });

    it('should handle generic errors with 500 status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/generic-error',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
