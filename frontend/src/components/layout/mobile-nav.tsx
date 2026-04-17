'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem, FooterLink } from '@/lib/nav-items';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Menu, Zap } from 'lucide-react';

interface MobileNavProps {
  items: NavItem[];
  footerLink?: FooterLink;
  badge?: string;
}

export function MobileNav({ items, footerLink, badge }: Readonly<MobileNavProps>) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex items-center gap-2 h-16 px-6 border-b">
          <Zap className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="text-lg font-bold">youboost</span>
          {badge && (
            <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full ml-1">
              {badge}
            </span>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {footerLink && (
          <div className="px-3 py-4 border-t">
            <Link
              href={footerLink.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <footerLink.icon className="h-4 w-4" aria-hidden="true" />
              {footerLink.label}
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
