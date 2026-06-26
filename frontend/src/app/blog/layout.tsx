import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/marketing/site-header';

// The blog lives at the app root (outside the marketing/dashboard route groups),
// so it needs the dark theme wrapper itself. The `dark` class flips the CSS
// variables (see globals.css), matching landing-page-view.tsx.
export default function BlogLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="dark flex min-h-screen flex-col bg-background font-display text-foreground">
      <SiteHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
