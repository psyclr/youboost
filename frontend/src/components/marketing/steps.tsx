import type { LandingResponse } from '@/lib/api/types';

interface StepsProps {
  steps: LandingResponse['steps'];
}

export function Steps({ steps }: StepsProps) {
  return (
    <section id="steps" className="bg-background pb-24">
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-24 md:px-8">
        <h2 className="max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-white md:text-[42px]">
          Three Steps. Less Than a Minute.
        </h2>
        <p className="mt-3 text-base text-muted-foreground">And get what you wanted.</p>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 md:grid-cols-3 md:px-8">
        {steps.map((step) => (
          <div
            key={step.n}
            className="flex items-center gap-4 rounded-md border border-white/10 bg-card p-5"
          >
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-[8px] text-2xl font-bold text-white"
              style={{ background: 'linear-gradient(145deg, #FE2721 0%, #8E0014 100%)' }}
            >
              {step.n}
            </div>
            <div>
              <h3 className="mb-1 text-lg font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
