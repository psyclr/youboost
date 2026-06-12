'use client';

import { Zap } from 'lucide-react';
import type { NavItem, FooterLink } from '@/lib/nav-items';
import { NavLinkItem } from './nav-link-item';

interface SidebarShellProps {
  items: NavItem[];
  footerLink?: FooterLink;
  badge?: string;
  onNavigate?: () => void;
}

// Shared logo + nav + optional footer used by the desktop sidebars and the
// mobile nav. Layout wrappers (fixed aside vs. sheet) stay with the callers.
export function SidebarShell({
  items,
  footerLink,
  badge,
  onNavigate,
}: Readonly<SidebarShellProps>) {
  return (
    <>
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
        {items.map((item) => (
          <NavLinkItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      {footerLink && (
        <div className="px-3 py-4 border-t">
          <NavLinkItem item={footerLink} onNavigate={onNavigate} alwaysMuted />
        </div>
      )}
    </>
  );
}
