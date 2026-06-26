import type { PaginatedPosts, PostResponse, SitemapEntry } from './types';

// Server-only client for the blog-engine service. Never import this into a
// client component — it carries the BLOG_ENGINE_API_KEY.

const REVALIDATE_SECONDS = 3600;

interface BlogEnv {
  url: string;
  apiKey: string;
}

function blogEnv(): BlogEnv | null {
  const url = process.env.BLOG_ENGINE_URL;
  const apiKey = process.env.BLOG_ENGINE_API_KEY;
  if (!url || !apiKey) return null;
  return { url, apiKey };
}

async function blogFetch(path: string): Promise<Response | null> {
  const env = blogEnv();
  if (!env) return null;
  try {
    return await fetch(`${env.url}${path}`, {
      headers: { Authorization: `Bearer ${env.apiKey}`, Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch {
    // blog-engine unreachable — callers degrade to empty/null.
    return null;
  }
}

export async function getPosts(page = 1, limit = 12): Promise<PaginatedPosts> {
  const empty: PaginatedPosts = { data: [], total: 0, page, limit };
  const res = await blogFetch(`/v1/posts?page=${page}&limit=${limit}`);
  if (!res?.ok) return empty;
  return (await res.json()) as PaginatedPosts;
}

export async function getPost(slug: string): Promise<PostResponse | null> {
  const res = await blogFetch(`/v1/posts/${encodeURIComponent(slug)}`);
  if (!res?.ok) return null;
  return (await res.json()) as PostResponse;
}

export async function getBlogSitemap(): Promise<SitemapEntry[]> {
  const res = await blogFetch('/v1/posts/sitemap');
  if (!res?.ok) return [];
  return (await res.json()) as SitemapEntry[];
}
