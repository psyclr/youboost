import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeAuthRedirect } from '@/components/marketing/home-auth-redirect';
import { LandingPageView } from '@/components/marketing/landing-page-view';
import type { LandingResponse } from '@/lib/api/types';

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
      title: 'youboost - SMM Panel',
      description: 'Social media marketing services platform',
      other: {
        cryptomus: 'e6db939d',
      },
    };
  }

  return {
    title: landing.seoTitle,
    description: landing.seoDescription,
    openGraph: {
      title: landing.seoTitle,
      description: landing.seoDescription,
      images: landing.seoOgImageUrl ? [landing.seoOgImageUrl] : undefined,
    },
    other: {
      cryptomus: 'e6db939d',
    },
  };
}

export default async function HomePage() {
  const landing = await fetchDefaultLanding();
  if (!landing) notFound();

  return (
    <>
      <HomeAuthRedirect />
      <LandingPageView landing={landing} />
    </>
  );
}
