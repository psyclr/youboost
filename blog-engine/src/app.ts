import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { PrismaClient } from './generated/prisma';
import { createLogger } from './shared/logger';
import { NotFoundError, ConflictError, UnauthorizedError, ValidationError } from './shared/errors';
import { createSitesRepository } from './modules/sites/sites.repository';
import { createSitesService } from './modules/sites/sites.service';
import { createPostsRepository } from './modules/posts/posts.repository';
import { createPostsService } from './modules/posts/posts.service';
import { createSitesRoutes } from './modules/sites/sites.routes';
import { createPublicPostsRoutes, createAdminPostsRoutes } from './modules/posts/posts.routes';
import type { BlogEngineConfig } from './shared/config';

const log = createLogger('http');

export async function createApp(prisma: PrismaClient, config: BlogEngineConfig) {
  const app = Fastify({ logger: log });

  await app.register(cors, { origin: true });

  // Global error handler
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotFoundError) return reply.status(404).send({ error: err.message });
    if (err instanceof ConflictError) return reply.status(409).send({ error: err.message });
    if (err instanceof UnauthorizedError) return reply.status(401).send({ error: err.message });
    if (err instanceof ValidationError) return reply.status(400).send({ error: err.message });
    // Zod validation errors
    if (err.name === 'ZodError') return reply.status(400).send({ error: 'Validation error', details: err.message });
    log.error({ err }, 'Unhandled error');
    return reply.status(500).send({ error: 'Internal server error' });
  });

  // Health check
  app.get('/health', async () => ({ ok: true, service: 'blog-engine' }));

  // Compose services
  const sitesRepo = createSitesRepository(prisma);
  const sitesService = createSitesService({
    sitesRepo,
    logger: createLogger('sites'),
    blogBaseUrl: 'blog-engine.io',
    skipDomainVerify: config.skipDomainVerify,
  });

  const postsRepo = createPostsRepository(prisma);
  const postsService = createPostsService({
    postsRepo,
    logger: createLogger('posts'),
    youboostRevalidateUrl: config.youboostRevalidateUrl,
    youboostRevalidateSecret: config.youboostRevalidateSecret,
  });

  // Public API routes
  await app.register(createPublicPostsRoutes(postsService, sitesService), { prefix: '/v1/posts' });

  // Admin API routes (no auth for MVP — protected by API key per request)
  await app.register(createSitesRoutes(sitesService), { prefix: '/sites' });
  await app.register(createAdminPostsRoutes(postsService), {
    prefix: '/sites/:siteId/posts',
  });

  return app;
}
