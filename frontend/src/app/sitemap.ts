import type { MetadataRoute } from 'next';

export const revalidate = 3600;

function getApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  );
}

async function fetchPublishedLandingSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/admin/landings?status=PUBLISHED&limit=200`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: { slug: string }[] };
    return data.data.map((l) => l.slug);
  } catch {
    return [];
  }
}

async function fetchPublishedBlogSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  try {
    const siteId = process.env.BLOG_SITE_ID;
    if (!siteId) return [];
    const res = await fetch(`${getApiBaseUrl()}/blog/sitemap?siteId=${siteId}`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    return (await res.json()) as { slug: string; updatedAt: string }[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://youboost.io';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/services`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/services/youtube`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/services/instagram`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/services/tiktok`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/services/twitter`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/services/facebook`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  const [landingSlugs, blogEntries] = await Promise.all([
    fetchPublishedLandingSlugs(),
    fetchPublishedBlogSlugs(),
  ]);

  const landingRoutes: MetadataRoute.Sitemap = landingSlugs.map((slug) => ({
    url: `${base}/lp/${slug}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogEntries.map((entry) => ({
    url: `${base}/blog/${entry.slug}`,
    lastModified: new Date(entry.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...landingRoutes, ...blogRoutes];
}
