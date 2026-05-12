'use client';

import { useState } from 'react';
import { CheckoutModal } from './checkout-modal';
import type { LandingResponse, LandingTierResponse } from '@/lib/api/types';

interface ServiceTiersProps {
  slug: string;
  tiers: LandingResponse['tiers'];
  defaultMinAmount: number;
}

function pillClassName(kind: LandingTierResponse['pillKind']): string {
  switch (kind) {
    case 'SALE':
      return 'bg-brand-lime text-brand-lime-fg';
    case 'MEGA_FAST':
      return 'text-white';
    case 'PREMIUM':
      return 'border border-white/20 bg-white/10 text-white';
    default:
      return '';
  }
}

function pillStyle(kind: LandingTierResponse['pillKind']): React.CSSProperties {
  if (kind === 'MEGA_FAST') {
    return { background: 'var(--grad-cosmic)' };
  }
  if (kind === 'PREMIUM') {
    return { background: 'var(--grad-premium-glow)' };
  }
  return {};
}

function pillLabel(kind: LandingTierResponse['pillKind']): string | null {
  switch (kind) {
    case 'SALE':
      return 'SALE';
    case 'MEGA_FAST':
      return 'MEGA FAST';
    case 'PREMIUM':
      return 'PREMIUM';
    default:
      return null;
  }
}

function tierBackground(glow: LandingTierResponse['glowKind']): string {
  switch (glow) {
    case 'ORANGE':
      return 'radial-gradient(circle at 20% 0%, #FF7B3A 0%, rgba(255,123,58,0) 55%), var(--brand-graphite)';
    case 'COSMIC':
      return 'radial-gradient(circle at 20% 0%, #6673FF 0%, rgba(102,115,255,0) 55%), var(--brand-graphite)';
    case 'PURPLE':
      return 'radial-gradient(circle at 20% 0%, #B842D8 0%, rgba(184,66,216,0) 55%), var(--brand-graphite)';
    default:
      return 'var(--brand-graphite)';
  }
}

function displayPrice(tier: LandingTierResponse): string {
  const raw = tier.priceOverride ?? tier.service.pricePer1000;
  return raw.toFixed(2);
}

export function ServiceTiers({ slug, tiers, defaultMinAmount }: ServiceTiersProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<LandingTierResponse | null>(null);

  const openCheckout = (tier: LandingTierResponse) => {
    setSelectedTier(tier);
    setModalOpen(true);
  };

  return (
    <section id="services" className="mt-16 bg-brand-ink pb-24">
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-24 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#FFAE00]">
          Services & Prices
        </span>
        <h2 className="mt-3 max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-white md:text-[42px]">
          Offers Especially for You.
        </h2>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 md:grid-cols-2 md:px-8 lg:grid-cols-4">
        {tiers.map((tier) => {
          const pill = pillLabel(tier.pillKind);
          const title = tier.titleOverride ?? tier.service.name;
          const desc = tier.descOverride ?? tier.service.description ?? '';
          return (
            <article
              key={tier.id}
              className="relative overflow-hidden rounded-xl border border-white/10 p-6 text-white"
              style={{ background: tierBackground(tier.glowKind) }}
            >
              {pill ? (
                <span
                  className={`mb-4 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider ${pillClassName(tier.pillKind)}`}
                  style={pillStyle(tier.pillKind)}
                >
                  {pill}
                </span>
              ) : null}
              <h3 className="text-xl font-bold">{title}</h3>
              {desc ? (
                <p className="mb-4 mt-1.5 text-[13px] text-white/65">{desc}</p>
              ) : (
                <div className="mb-4" />
              )}
              <div className="mb-5 flex items-baseline gap-1">
                <span className="text-base text-white/55">$</span>
                <span className="text-[36px] font-bold leading-none">{displayPrice(tier)}</span>
                <span className="ml-1 text-xs text-white/55">/ {tier.unit}</span>
              </div>
              <button
                type="button"
                onClick={() => openCheckout(tier)}
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Buy Now
              </button>
            </article>
          );
        })}
      </div>
      {selectedTier ? (
        <CheckoutModal
          slug={slug}
          tiers={tiers}
          open={modalOpen}
          onOpenChange={setModalOpen}
          initialTier={selectedTier}
          initialLink=""
          defaultMinAmount={defaultMinAmount}
        />
      ) : null}
    </section>
  );
}
