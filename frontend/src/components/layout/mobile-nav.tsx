'use client';

import { useState } from 'react';
import type { NavItem, FooterLink } from '@/lib/nav-items';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { SidebarShell } from './sidebar-shell';

interface MobileNavProps {
  items: NavItem[];
  footerLink?: FooterLink;
  badge?: string;
}

export function MobileNav({ items, footerLink, badge }: Readonly<MobileNavProps>) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarShell
          items={items}
          footerLink={footerLink}
          badge={badge}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
