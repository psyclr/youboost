import type { LandingResponse } from '@/lib/api/types';
import { HeroCalculator } from './hero-calculator';

interface HeroProps {
  slug: string;
  hero: LandingResponse['hero'];
  stats: LandingResponse['stats'];
  tiers: LandingResponse['tiers'];
}

export function Hero({ slug, hero, stats, tiers }: HeroProps) {
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
          <HeroCalculator slug={slug} hero={hero} tiers={tiers} />
        </div>
      </div>
    </section>
  );
}
