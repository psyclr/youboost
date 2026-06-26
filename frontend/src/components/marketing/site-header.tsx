import Image from 'next/image';
import Link from 'next/link';

const navLinks = [
  { label: 'Services', href: '#services' },
  { label: 'How It Works', href: '#steps' },
  { label: 'Pricing', href: '#services' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Blog', href: '/blog' },
];

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10"
      style={{
        background: 'rgba(10,10,10,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-3 px-6 md:gap-6 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-white no-underline">
          <Image
            src="/brand/logo-mark-square-red.svg"
            alt="YouBoost"
            width={34}
            height={34}
            priority
          />
          <span className="text-lg font-bold tracking-tight">YouBoost</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-white/90"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}
