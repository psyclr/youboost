import type { PrismaClient, BlogPost } from '../../generated/prisma';
import type { CreatePostInput, UpdatePostInput, ListPostsQuery, SitemapEntry } from './posts.types';

export interface PostsRepository {
  findById(id: string): Promise<BlogPost | null>;
  findBySlug(siteId: string, slug: string): Promise<BlogPost | null>;
  list(siteId: string, query: ListPostsQuery): Promise<{ items: BlogPost[]; total: number }>;
  listPublished(siteId: string, query: ListPostsQuery): Promise<{ items: BlogPost[]; total: number }>;
  sitemapEntries(siteId: string): Promise<SitemapEntry[]>;
  create(siteId: string, input: CreatePostInput): Promise<BlogPost>;
  update(id: string, input: UpdatePostInput): Promise<BlogPost>;
  publish(id: string): Promise<BlogPost>;
  delete(id: string): Promise<void>;
  incrementViews(id: string): Promise<void>;
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function createPostsRepository(prisma: PrismaClient): PostsRepository {
  return {
    findById: (id) => prisma.blogPost.findUnique({ where: { id } }),

    findBySlug: (siteId, slug) =>
      prisma.blogPost.findUnique({ where: { siteId_slug: { siteId, slug } } }),

    async list(siteId, query) {
      const where = {
        siteId,
        ...(query.status ? { status: query.status } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.blogPost.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.blogPost.count({ where }),
      ]);
      return { items, total };
    },

    async listPublished(siteId, query) {
      const where = { siteId, status: 'PUBLISHED' as const };
      const [items, total] = await Promise.all([
        prisma.blogPost.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { publishedAt: 'desc' },
        }),
        prisma.blogPost.count({ where }),
      ]);
      return { items, total };
    },

    async sitemapEntries(siteId) {
      const posts = await prisma.blogPost.findMany({
        where: { siteId, status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
      });
      return posts.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() }));
    },

    async create(siteId, input) {
      return prisma.blogPost.create({
        data: {
          siteId,
          slug: input.slug,
          title: input.title,
          description: input.description,
          content: input.content,
          status: input.status ?? 'DRAFT',
          targetKeyword: input.targetKeyword ?? null,
          secondaryKeywords: input.secondaryKeywords ?? [],
          author: input.author ?? 'AI',
          coverImageUrl: input.coverImageUrl ?? null,
          coverImageAlt: input.coverImageAlt ?? null,
          readingTimeMin: estimateReadingTime(input.content),
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        },
      });
    },

    async update(id, input) {
      const data: Parameters<typeof prisma.blogPost.update>[0]['data'] = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.content !== undefined) {
        data.content = input.content;
        data.readingTimeMin = estimateReadingTime(input.content);
      }
      if (input.status !== undefined) {
        data.status = input.status;
        if (input.status === 'PUBLISHED') data.publishedAt = new Date();
      }
      if (input.targetKeyword !== undefined) data.targetKeyword = input.targetKeyword;
      if (input.secondaryKeywords !== undefined) data.secondaryKeywords = input.secondaryKeywords;
      if (input.author !== undefined) data.author = input.author;
      if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;
      if (input.coverImageAlt !== undefined) data.coverImageAlt = input.coverImageAlt;
      return prisma.blogPost.update({ where: { id }, data });
    },

    async publish(id) {
      return prisma.blogPost.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
    },

    async delete(id) {
      await prisma.blogPost.delete({ where: { id } });
    },

    async incrementViews(id) {
      await prisma.blogPost.update({
        where: { id },
        data: { pageViews: { increment: 1 } },
      });
    },
  };
}
