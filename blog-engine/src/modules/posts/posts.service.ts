import type { Logger } from 'pino';
import { ConflictError, NotFoundError } from '../../shared/errors';
import type { PostsRepository } from './posts.repository';
import type {
  CreatePostInput,
  UpdatePostInput,
  ListPostsQuery,
  PostResponse,
  PostSummary,
  PaginatedPosts,
  SitemapEntry,
} from './posts.types';
import type { BlogPost } from '../../generated/prisma';

function presentPost(post: BlogPost): PostResponse {
  return {
    id: post.id,
    siteId: post.siteId,
    slug: post.slug,
    title: post.title,
    description: post.description,
    content: post.content,
    status: post.status,
    targetKeyword: post.targetKeyword,
    secondaryKeywords: post.secondaryKeywords,
    author: post.author,
    coverImageUrl: post.coverImageUrl,
    coverImageAlt: post.coverImageAlt,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    readingTimeMin: post.readingTimeMin,
    pageViews: post.pageViews,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function presentSummary(post: BlogPost): PostSummary {
  return {
    id: post.id,
    siteId: post.siteId,
    slug: post.slug,
    title: post.title,
    description: post.description,
    status: post.status,
    coverImageUrl: post.coverImageUrl,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    readingTimeMin: post.readingTimeMin,
    targetKeyword: post.targetKeyword,
    createdAt: post.createdAt.toISOString(),
  };
}

export interface PostsServiceDeps {
  postsRepo: PostsRepository;
  logger: Logger;
  youboostRevalidateUrl: string | null;
  youboostRevalidateSecret: string | null;
}

export interface PostsService {
  listPublished(siteId: string, query: ListPostsQuery): Promise<PaginatedPosts>;
  getPublishedBySlug(siteId: string, slug: string): Promise<PostResponse>;
  sitemapEntries(siteId: string): Promise<SitemapEntry[]>;
  adminList(siteId: string, query: ListPostsQuery): Promise<PaginatedPosts>;
  adminCreate(siteId: string, input: CreatePostInput): Promise<PostResponse>;
  adminUpdate(id: string, input: UpdatePostInput): Promise<PostResponse>;
  adminPublish(id: string): Promise<PostResponse>;
  adminDelete(id: string): Promise<void>;
}

export function createPostsService(deps: PostsServiceDeps): PostsService {
  const { postsRepo, logger, youboostRevalidateUrl, youboostRevalidateSecret } = deps;

  async function triggerRevalidation(slug: string): Promise<void> {
    if (!youboostRevalidateUrl || !youboostRevalidateSecret) return;
    try {
      await fetch(youboostRevalidateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': youboostRevalidateSecret,
        },
        body: JSON.stringify({ slug }),
      });
    } catch (err) {
      logger.warn({ err, slug }, 'Failed to trigger ISR revalidation');
    }
  }

  return {
    async listPublished(siteId, query) {
      const { items, total } = await postsRepo.listPublished(siteId, query);
      return { data: items.map(presentSummary), total, page: query.page, limit: query.limit };
    },

    async getPublishedBySlug(siteId, slug) {
      const post = await postsRepo.findBySlug(siteId, slug);
      if (!post || post.status !== 'PUBLISHED') throw new NotFoundError(`Post not found: ${slug}`);
      await postsRepo.incrementViews(post.id);
      return presentPost(post);
    },

    sitemapEntries: (siteId) => postsRepo.sitemapEntries(siteId),

    async adminList(siteId, query) {
      const { items, total } = await postsRepo.list(siteId, query);
      return { data: items.map(presentSummary), total, page: query.page, limit: query.limit };
    },

    async adminCreate(siteId, input) {
      const existing = await postsRepo.findBySlug(siteId, input.slug);
      if (existing) throw new ConflictError(`Slug '${input.slug}' already exists in this site`);
      const post = await postsRepo.create(siteId, input);
      if (post.status === 'PUBLISHED') await triggerRevalidation(post.slug);
      logger.info({ postId: post.id, siteId }, 'Post created');
      return presentPost(post);
    },

    async adminUpdate(id, input) {
      const existing = await postsRepo.findById(id);
      if (!existing) throw new NotFoundError(`Post not found: ${id}`);
      const post = await postsRepo.update(id, input);
      if (post.status === 'PUBLISHED') await triggerRevalidation(post.slug);
      return presentPost(post);
    },

    async adminPublish(id) {
      const existing = await postsRepo.findById(id);
      if (!existing) throw new NotFoundError(`Post not found: ${id}`);
      const post = await postsRepo.publish(id);
      await triggerRevalidation(post.slug);
      logger.info({ postId: id }, 'Post published');
      return presentPost(post);
    },

    async adminDelete(id) {
      const existing = await postsRepo.findById(id);
      if (!existing) throw new NotFoundError(`Post not found: ${id}`);
      await postsRepo.delete(id);
    },
  };
}
