import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://youboost.io';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/billing/',
          '/orders/',
          '/settings/',
          '/support/',
          '/referral/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
