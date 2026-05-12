import type { LandingResponse } from '@/lib/api/types';

interface StepsProps {
  steps: LandingResponse['steps'];
}

export function Steps({ steps }: StepsProps) {
  return (
    <section id="steps" className="bg-background pb-24">
      <div className="mx-auto max-w-[1100px] px-6 pb-8 pt-24 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-brand-red">
          How It Works
        </span>
        <h2 className="mt-3 max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-brand-ink md:text-[42px]">
          Three Steps. Less Than a Minute.
        </h2>
      </div>
      <div className="mx-auto grid max-w-[1100px] gap-8 px-6 md:grid-cols-3 md:px-8">
        {steps.map((step) => (
          <div key={step.n} className="text-center">
            <div
              className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-brand-red text-[22px] font-bold text-white"
              style={{ boxShadow: 'var(--shadow-glow-red)' }}
            >
              {step.n}
            </div>
            <h3 className="mb-1.5 text-xl font-bold text-brand-ink">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
