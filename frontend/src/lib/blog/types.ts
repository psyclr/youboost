// Mirrors blog-engine's posts.types.ts response shapes. The frontend must NOT
// import from blog-engine/src (separate service), so the shapes are duplicated.

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

export interface PostResponse extends PostSummary {
  content: string;
  secondaryKeywords: string[];
  author: string;
  coverImageAlt: string | null;
  pageViews: number;
  updatedAt: string;
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
