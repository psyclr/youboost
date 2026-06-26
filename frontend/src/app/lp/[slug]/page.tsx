import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LandingPageView } from '@/components/marketing/landing-page-view';
import type { LandingResponse } from '@/lib/api/types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  );
}

async function fetchLanding(slug: string): Promise<LandingResponse | null> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}/landing/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) return null;
  return (await response.json()) as LandingResponse;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const landing = await fetchLanding(slug);
  if (!landing) {
    return { title: 'Not Found' };
  }
  return {
    title: landing.seoTitle,
    description: landing.seoDescription,
    alternates: { canonical: `/lp/${slug}` },
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
  };
}

export default async function LandingPage({ params }: PageProps) {
  const { slug } = await params;
  const landing = await fetchLanding(slug);
  if (!landing) notFound();

  return <LandingPageView landing={landing} />;
}
