'use client';

import Image from 'next/image';
import { useState } from 'react';
import { CheckoutModal } from './checkout-modal';
import type { LandingResponse } from '@/lib/api/types';

interface HeroProps {
  slug: string;
  hero: LandingResponse['hero'];
  stats: LandingResponse['stats'];
  tiers: LandingResponse['tiers'];
}

function pickDefaultTier(
  tiers: LandingResponse['tiers'],
  defaultServiceId: string | null,
): LandingResponse['tiers'][number] | null {
  if (tiers.length === 0) return null;
  if (defaultServiceId) {
    const match = tiers.find((t) => t.serviceId === defaultServiceId);
    if (match) return match;
  }
  const sale = tiers.find((t) => t.pillKind === 'SALE');
  if (sale) return sale;
  return tiers[0];
}

export function Hero({ slug, hero, stats, tiers }: HeroProps) {
  const [link, setLink] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTier, setInitialTier] = useState<LandingResponse['tiers'][number] | null>(null);
  const [initialLink, setInitialLink] = useState('');

  const openFromHero = (e: React.FormEvent) => {
    e.preventDefault();
    const tier = pickDefaultTier(tiers, hero.defaultServiceId);
    if (!tier) return;
    setInitialTier(tier);
    setInitialLink(link);
    setModalOpen(true);
  };

  return (
    <section className="relative overflow-hidden bg-brand-ink text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 600px at 100% 30%, rgba(241,0,4,0.40) 0%, rgba(241,0,4,0) 60%), radial-gradient(700px 500px at 95% 90%, rgba(212,0,255,0.30) 0%, rgba(212,0,255,0) 65%)',
        }}
      />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-6 py-24 md:px-8 md:py-28 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-[560px]">
          {hero.eyebrow ? (
            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium tracking-wider text-white/85">
              {hero.eyebrow}
            </span>
          ) : null}
          <h1 className="mt-4 mb-4 text-[44px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[64px]">
            {hero.title}
            {hero.accent ? (
              <>
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'var(--grad-sunset)' }}
                >
                  {hero.accent}
                </span>
              </>
            ) : null}
          </h1>
          <p className="mb-7 text-base leading-relaxed text-white/75 md:text-lg">{hero.lead}</p>
          <form
            onSubmit={openFromHero}
            className="flex gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-1.5"
          >
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={hero.placeholder}
              className="flex-1 bg-transparent px-3.5 py-3 text-base text-white placeholder:text-white/45 outline-none"
              aria-label={hero.placeholder}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90"
              style={{
                background: 'var(--grad-sunset)',
                boxShadow: 'var(--shadow-glow-red)',
                letterSpacing: '0.02em',
              }}
            >
              {hero.ctaLabel}
            </button>
          </form>
          {hero.fineprint ? <p className="mt-2.5 text-xs text-white/50">{hero.fineprint}</p> : null}
          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <strong className="text-2xl font-bold text-white">{stat.value}</strong>
                <span className="mt-1 text-xs text-white/55">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Image
            src="/brand/red-bar-3d.png"
            alt=""
            width={480}
            height={480}
            className="h-auto w-full max-w-[480px]"
            style={{ filter: 'drop-shadow(0 24px 48px rgba(241,0,4,0.4))' }}
            priority
          />
        </div>
      </div>
      {initialTier ? (
        <CheckoutModal
          slug={slug}
          tiers={tiers}
          open={modalOpen}
          onOpenChange={setModalOpen}
          initialTier={initialTier}
          initialLink={initialLink}
          defaultMinAmount={hero.minAmount}
        />
      ) : null}
    </section>
  );
}
