'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  BookOpen,
  ArrowLeft,
  Zap,
  Server,
  MessageSquare,
  Tag,
  Link2,
} from 'lucide-react';

const adminItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/services', label: 'Services', icon: Package },
  { href: '/admin/providers', label: 'Providers', icon: Server },
  { href: '/admin/support', label: 'Support', icon: MessageSquare },
  { href: '/admin/coupons', label: 'Coupons', icon: Tag },
  { href: '/admin/referrals', label: 'Tracking', icon: Link2 },
  { href: '/admin/docs', label: 'Documentation', icon: BookOpen },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex items-center gap-2 h-16 px-6 border-b">
        <Zap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">youboost</span>
        <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full ml-1">
          Admin
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {adminItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Panel
        </Link>
      </div>
    </aside>
  );
}
