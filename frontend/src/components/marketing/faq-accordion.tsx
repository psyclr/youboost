'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { LandingResponse } from '@/lib/api/types';

interface FaqAccordionProps {
  faq: LandingResponse['faq'];
}

export function FaqAccordion({ faq }: FaqAccordionProps) {
  if (faq.length === 0) return null;
  return (
    <section id="faq" className="pb-24" style={{ background: 'var(--n-50)' }}>
      <div className="mx-auto max-w-[880px] px-6 pb-8 pt-24 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-brand-red">FAQ</span>
        <h2 className="mt-3 max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-brand-ink md:text-[42px]">
          We Have the Answers to All Your Questions.
        </h2>
      </div>
      <div className="mx-auto max-w-[880px] px-6 md:px-8">
        <Accordion type="single" collapsible defaultValue="faq-0" className="flex flex-col gap-2.5">
          {faq.map((item, i) => (
            <AccordionItem key={item.question} value={`faq-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
