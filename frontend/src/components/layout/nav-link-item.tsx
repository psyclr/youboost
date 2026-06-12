'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem, FooterLink } from '@/lib/nav-items';

interface NavLinkItemProps {
  item: NavItem | FooterLink;
  onNavigate?: () => void;
  // Footer links render always-muted (no active highlight), matching the
  // original sidebar footer markup.
  alwaysMuted?: boolean;
}

// Shared nav link used by the user sidebar, admin sidebar and mobile nav.
// `exact` (NavItem only) restricts the active state to an exact path match;
// otherwise a path prefix match marks the link active.
export function NavLinkItem({ item, onNavigate, alwaysMuted = false }: Readonly<NavLinkItemProps>) {
  const pathname = usePathname();
  const exact = 'exact' in item ? item.exact : false;
  const isActive =
    !alwaysMuted &&
    (exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/'));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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
}
