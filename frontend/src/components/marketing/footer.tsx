import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { LandingResponse } from '@/lib/api/types';

interface FooterProps {
  footerCta: LandingResponse['footerCta'];
}

export function Footer({ footerCta }: FooterProps) {
  return (
    <>
      {footerCta ? (
        <section className="relative overflow-hidden bg-brand-ink text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(600px 400px at 85% 50%, rgba(241,0,4,0.35) 0%, rgba(241,0,4,0) 65%)',
            }}
          />
          <div className="relative mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between md:gap-10 md:px-8">
            <div className="max-w-[640px]">
              <h3 className="text-3xl font-bold leading-tight md:text-[40px]">{footerCta.title}</h3>
              <p className="mt-3 text-base text-white/70 md:text-lg">{footerCta.lead}</p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link href={footerCta.href}>{footerCta.label}</Link>
            </Button>
          </div>
        </section>
      ) : null}
      <footer className="bg-brand-ink text-white/70">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-16 md:grid-cols-[1.5fr_2fr] md:px-8">
          <div>
            <Image
              src="/brand/logo-full-on-dark.svg"
              alt="YouBoost"
              width={180}
              height={36}
              className="h-9 w-auto"
            />
            <p className="mt-4 max-w-[320px] text-sm leading-relaxed text-white/55">
              The fastest SMM panel on earth. 4M+ orders delivered.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            <div>
              <h4 className="mb-4 text-sm font-bold text-white">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#services" className="transition-colors hover:text-white">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#services" className="transition-colors hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#steps" className="transition-colors hover:text-white">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold text-white">Account</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/login" className="transition-colors hover:text-white">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="transition-colors hover:text-white">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold text-white">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="transition-colors hover:text-white">
                    Refunds
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-2 border-t border-white/10 px-6 py-6 text-sm text-white/45 md:flex-row md:items-center md:px-8">
          <span>&copy; {new Date().getFullYear()} YouBoost. All Rights Reserved.</span>
          <span>Made for Creators.</span>
        </div>
      </footer>
    </>
  );
}
