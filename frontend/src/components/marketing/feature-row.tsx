import { Zap, ShieldCheck, Rocket } from 'lucide-react';

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
    icon: Rocket,
    title: 'Quick Result',
    desc: 'Most services complete within 24 hours — first day visible.',
  },
];

export function FeatureRow() {
  return (
    <section className="bg-background pb-12">
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-24 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-brand-red">
          Why YouBoost
        </span>
        <h2 className="mt-3 max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-brand-ink md:text-[42px]">
          Built for creators who can&apos;t wait.
        </h2>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 md:grid-cols-3 md:px-8">
        {features.map((f) => (
          <article
            key={f.title}
            className="rounded-xl border border-border p-6"
            style={{
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="mb-4 flex size-11 items-center justify-center rounded-[10px] text-brand-red"
              style={{ background: 'rgba(241,0,4,0.08)' }}
            >
              <f.icon className="size-[22px]" strokeWidth={1.5} />
            </div>
            <h3 className="mb-1.5 text-lg font-bold text-brand-ink">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
