import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { StatusCodes } from 'http-status-codes';
import type { Logger } from 'pino';
import { openapiSpec } from '../shared/swagger/openapi-spec';
import { AppError } from '../shared/errors/app-error';
import { checkHealth } from '../shared/health/health';

export interface FastifySetupConfig {
  corsOrigin: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

export async function setupFastifyApp(
  config: FastifySetupConfig,
  logger: Logger,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  const corsOrigins = config.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  await app.register(cors, { origin: corsOrigins });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
  });
  await app.register(swagger, {
    mode: 'static',
    specification: { document: openapiSpec },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
    logger.info(
      { method: request.method, url: request.url, reqId: request.id },
      'request received',
    );
    done();
  });

  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    logger.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode, reqId: request.id },
      'request completed',
    );
    done();
  });

  app.setErrorHandler((error: Error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    const fastifyError = error as Error & { validation?: unknown; statusCode?: number };
    if (fastifyError.validation) {
      return reply.status(StatusCodes.UNPROCESSABLE_ENTITY).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: fastifyError.validation,
        },
      });
    }
    logger.error({ err: error }, 'Unhandled error');
    return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(StatusCodes.NOT_FOUND).send({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    }),
  );

  app.get('/health', async () => checkHealth());
  app.get('/', async () => ({
    name: 'youboost-api',
    version: '0.1.0-alpha',
    status: 'running',
  }));

  return app;
}
