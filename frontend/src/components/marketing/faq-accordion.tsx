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
    <section id="faq" className="bg-background pb-24">
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-24 md:px-8">
        <h2 className="max-w-[720px] text-3xl font-bold leading-[1.15] tracking-[-0.01em] text-white md:text-[42px]">
          We Have the Answers to All Your Questions.
        </h2>
        <p className="mt-3 text-base text-muted-foreground">We will answer all your questions.</p>
      </div>
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <Accordion type="single" collapsible defaultValue="faq-0" className="flex flex-col gap-2.5">
          {faq.map((item, i) => (
            <AccordionItem key={item.question} value={`faq-${i}`} className="rounded-md">
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
