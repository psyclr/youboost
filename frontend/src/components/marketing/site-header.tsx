'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const navLinks = [
  { label: 'Services', href: '#services' },
  { label: 'How It Works', href: '#steps' },
  { label: 'Pricing', href: '#services' },
  { label: 'FAQ', href: '#faq' },
];

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-6 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-brand-ink no-underline">
          <Image
            src="/brand/logo-mark-square-red.svg"
            alt="YouBoost"
            width={34}
            height={34}
            priority
          />
          <span className="text-lg font-bold tracking-tight">youboost</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-[var(--n-700)] transition-colors hover:text-brand-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Sign Up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
