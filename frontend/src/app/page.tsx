import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeAuthRedirect } from '@/components/marketing/home-auth-redirect';
import { LandingPageView } from '@/components/marketing/landing-page-view';
import type { LandingResponse } from '@/lib/api/types';
import { organizationJsonLd, websiteJsonLd } from '@/lib/structured-data';

export const dynamic = 'force-dynamic';

function getApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  );
}

async function fetchDefaultLanding(): Promise<LandingResponse | null> {
  const base = getApiBaseUrl();
  try {
    const response = await fetch(`${base}/landing/default`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return (await response.json()) as LandingResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const landing = await fetchDefaultLanding();
  if (!landing) {
    return {
      title: 'YouBoost — SMM Panel',
      description: 'Social media marketing services platform',
      alternates: { canonical: '/' },
      other: { cryptomus: 'e6db939d' },
    };
  }

  return {
    title: landing.seoTitle,
    description: landing.seoDescription,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      title: landing.seoTitle,
      description: landing.seoDescription,
      images: landing.seoOgImageUrl ? [landing.seoOgImageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: landing.seoTitle,
      description: landing.seoDescription,
      images: landing.seoOgImageUrl ? [landing.seoOgImageUrl] : undefined,
    },
    other: { cryptomus: 'e6db939d' },
  };
}

export default async function HomePage() {
  const landing = await fetchDefaultLanding();
  if (!landing) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://youboost.io';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(siteUrl)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd(siteUrl)) }}
      />
      <HomeAuthRedirect />
      <LandingPageView landing={landing} />
    </>
  );
}
