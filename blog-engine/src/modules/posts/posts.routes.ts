import type { FastifyInstance } from 'fastify';
import type { PostsService } from './posts.service';
import type { SitesService } from '../sites/sites.service';
import { CreatePostSchema, UpdatePostSchema, ListPostsQuerySchema } from './posts.types';
import { UnauthorizedError } from '../../shared/errors';

function extractApiKey(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

export function createPublicPostsRoutes(postsService: PostsService, sitesService: SitesService) {
  return async function (app: FastifyInstance) {
    // GET /v1/posts — requires API key
    app.get('/', async (req, reply) => {
      const apiKey = extractApiKey(req);
      if (!apiKey) throw new UnauthorizedError('API key required');
      const site = await sitesService.getByApiKey(apiKey);
      const query = ListPostsQuerySchema.parse(req.query);
      const result = await postsService.listPublished(site.id, query);
      return reply.send(result);
    });

    // GET /v1/posts/:slug — public (API key optional, falls back to Host header lookup)
    app.get('/:slug', async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const apiKey = extractApiKey(req);
      let siteId: string;

      if (apiKey) {
        const site = await sitesService.getByApiKey(apiKey);
        siteId = site.id;
      } else {
        // Hosted mode: resolve site by Host header
        const host = (req.headers['host'] as string) ?? '';
        const site = await sitesService.getByDomainOrSubdomain(host);
        siteId = site.id;
      }

      const post = await postsService.getPublishedBySlug(siteId, slug);
      return reply.send(post);
    });

    // GET /v1/sitemap — public
    app.get('/sitemap', async (req, reply) => {
      const apiKey = extractApiKey(req);
      if (!apiKey) throw new UnauthorizedError('API key required');
      const site = await sitesService.getByApiKey(apiKey);
      const entries = await postsService.sitemapEntries(site.id);
      return reply.send(entries);
    });
  };
}

export function createAdminPostsRoutes(postsService: PostsService) {
  return async function (app: FastifyInstance) {
    // All routes scoped to /sites/:siteId/posts
    app.get('/', async (req, reply) => {
      const { siteId } = req.params as { siteId: string };
      const query = ListPostsQuerySchema.parse(req.query);
      const result = await postsService.adminList(siteId, query);
      return reply.send(result);
    });

    app.post('/', async (req, reply) => {
      const { siteId } = req.params as { siteId: string };
      const input = CreatePostSchema.parse(req.body);
      const post = await postsService.adminCreate(siteId, input);
      return reply.status(201).send(post);
    });

    app.patch('/:postId', async (req, reply) => {
      const { postId } = req.params as { postId: string };
      const input = UpdatePostSchema.parse(req.body);
      const post = await postsService.adminUpdate(postId, input);
      return reply.send(post);
    });

    app.post('/:postId/publish', async (req, reply) => {
      const { postId } = req.params as { postId: string };
      const post = await postsService.adminPublish(postId);
      return reply.send(post);
    });

    app.delete('/:postId', async (req, reply) => {
      const { postId } = req.params as { postId: string };
      await postsService.adminDelete(postId);
      return reply.status(204).send();
    });
  };
}
