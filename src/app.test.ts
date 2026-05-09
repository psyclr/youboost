import type { FastifyInstance } from 'fastify';
import { createApp, type CreateAppDeps } from './app';
import { AppError } from './shared/errors/app-error';
import { loadConfig } from './shared/config/env';
import type { PrismaClient } from './generated/prisma';
import type Redis from 'ioredis';
import type { EmailProvider } from './modules/notifications';

jest.mock('./shared/health/health', () => ({
  createHealthCheck: jest.fn().mockReturnValue(async () => ({
    status: 'ok',
    checks: {
      database: true,
      redis: true,
      memory: { rss: 1000, heapUsed: 500, heapTotal: 2000 },
    },
    uptime: 123,
    timestamp: '2025-01-01T00:00:00.000Z',
  })),
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
    fatal: jest.fn(),
    trace: jest.fn(),
    child: jest.fn().mockReturnThis(),
  }),
  createRequestLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Stub the shared queue (BullMQ) — not needed for route/error-handler tests.
jest.mock('./shared/queue', () => ({
  startNamedWorker: jest.fn().mockResolvedValue(undefined),
  stopNamedWorker: jest.fn().mockResolvedValue(undefined),
  getNamedQueue: jest.fn().mockReturnValue({
    add: jest.fn().mockResolvedValue(undefined),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakePrisma = {} as any as PrismaClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeRedis = { incr: jest.fn(), expire: jest.fn() } as any as Redis;
const fakeEmailProvider: EmailProvider = { send: jest.fn().mockResolvedValue(undefined) };

describe('App Factory', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const deps: CreateAppDeps = {
      prisma: fakePrisma,
      redis: fakeRedis,
      emailProvider: fakeEmailProvider,
      config: loadConfig(),
    };
    const created = await createApp(deps);
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
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.checks).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('youboost-api');
      expect(body.version).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({ method: 'GET', url: '/unknown-route' });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should handle AppError with correct status and body', async () => {
      const response = await app.inject({ method: 'GET', url: '/test/app-error' });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('TEST_ERROR');
      expect(body.error.message).toBe('Test error');
      expect(body.error.details).toEqual({ test: true });
    });

    it('should handle generic errors with 500 status', async () => {
      const response = await app.inject({ method: 'GET', url: '/test/generic-error' });
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
