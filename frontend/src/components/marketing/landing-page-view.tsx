import { SiteHeader } from '@/components/marketing/site-header';
import { Hero } from '@/components/marketing/hero';
import { FeatureRow } from '@/components/marketing/feature-row';
import { ServiceTiers } from '@/components/marketing/service-tiers';
import { Steps } from '@/components/marketing/steps';
import { FaqAccordion } from '@/components/marketing/faq-accordion';
import { Footer } from '@/components/marketing/footer';
import type { LandingResponse } from '@/lib/api/types';

export function LandingPageView({ landing }: Readonly<{ landing: LandingResponse }>) {
  return (
    <div className="dark flex min-h-screen flex-col bg-background font-display text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero hero={landing.hero} stats={landing.stats} />
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
