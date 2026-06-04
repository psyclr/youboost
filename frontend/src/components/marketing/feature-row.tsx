import { Zap, ShieldCheck, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Instant Start',
    desc: 'Orders begin processing the second they hit the queue.',
  },
  {
    icon: ShieldCheck,
    title: 'Guarantee',
    desc: 'Refill guarantee on premium tiers. No drop, no worry.',
  },
  {
    icon: TrendingUp,
    title: 'Quick Result',
    desc: 'Most services complete within 24 hours — first day visible.',
  },
];

export function FeatureRow() {
  return (
    <section className="bg-background pb-12">
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-24 md:px-8">
        <h2 className="max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-white md:text-[42px]">
          Why is it worth working with us?
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Built for creators who can&apos;t wait.
        </p>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 md:grid-cols-3 md:px-8">
        {features.map((f) => (
          <article key={f.title} className="rounded-md border border-white/10 bg-card p-6">
            <div
              className="mb-4 flex size-11 items-center justify-center rounded-[8px] text-white"
              style={{ background: 'linear-gradient(145deg, #FE2721 0%, #B3001B 100%)' }}
            >
              <f.icon className="size-[22px]" strokeWidth={1.75} />
            </div>
            <h3 className="mb-1.5 text-lg font-semibold text-white">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </article>
        ))}
      </div>
      <div className="mx-auto mt-4 max-w-[1280px] px-6 md:px-8">
        <div
          className="relative flex aspect-[16/8] w-full items-center justify-center overflow-hidden rounded-md border border-white/10"
          style={{ background: 'linear-gradient(160deg, #0d0d0d 0%, #1b1b1b 100%)' }}
        >
          <button
            type="button"
            aria-label="Play video"
            className="group flex size-[110px] items-center justify-center rounded-full transition-transform hover:scale-105"
            style={{ background: 'radial-gradient(circle at 50% 35%, #2a2a2a 0%, #0a0a0a 80%)' }}
          >
            <svg width="40" height="44" viewBox="0 0 40 44" fill="none" aria-hidden>
              <defs>
                <linearGradient
                  id="play-grad"
                  x1="0"
                  y1="0"
                  x2="40"
                  y2="44"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#FF0276" />
                  <stop offset="1" stopColor="#FF621A" />
                </linearGradient>
              </defs>
              <path
                d="M38 19.4 4.5 1.1A3 3 0 0 0 0 3.7v36.6a3 3 0 0 0 4.5 2.6L38 24.6a3 3 0 0 0 0-5.2Z"
                fill="url(#play-grad)"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
