import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/marketing/site-header';
import { Hero } from '@/components/marketing/hero';
import { FeatureRow } from '@/components/marketing/feature-row';
import { ServiceTiers } from '@/components/marketing/service-tiers';
import { Steps } from '@/components/marketing/steps';
import { FaqAccordion } from '@/components/marketing/faq-accordion';
import { Footer } from '@/components/marketing/footer';
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
    openGraph: {
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Hero slug={landing.slug} hero={landing.hero} stats={landing.stats} tiers={landing.tiers} />
        <FeatureRow />
        <ServiceTiers
          slug={landing.slug}
          tiers={landing.tiers}
          defaultMinAmount={landing.hero.minAmount}
        />
        <Steps steps={landing.steps} />
        <FaqAccordion faq={landing.faq} />
      </main>
      <Footer footerCta={landing.footerCta} />
    </div>
  );
}
