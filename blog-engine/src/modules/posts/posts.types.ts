import { z } from 'zod';

export const CreatePostSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers, hyphens only'),
  title: z.string().min(10).max(160),
  description: z.string().min(50).max(320),
  content: z.string().min(100),
  targetKeyword: z.string().max(255).optional(),
  secondaryKeywords: z.array(z.string().max(100)).default([]),
  author: z.string().max(100).default('AI'),
  coverImageUrl: z.string().url().optional(),
  coverImageAlt: z.string().max(255).optional(),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export const UpdatePostSchema = CreatePostSchema.partial();

export const ListPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  tag: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type ListPostsQuery = z.infer<typeof ListPostsQuerySchema>;

export interface PostResponse {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  status: string;
  targetKeyword: string | null;
  secondaryKeywords: string[];
  author: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string | null;
  readingTimeMin: number | null;
  pageViews: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostSummary {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  readingTimeMin: number | null;
  targetKeyword: string | null;
  createdAt: string;
}

export interface PaginatedPosts {
  data: PostSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface SitemapEntry {
  slug: string;
  updatedAt: string;
}
