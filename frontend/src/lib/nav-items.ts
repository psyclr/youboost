import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
  BookOpen,
  MessageSquare,
  Users,
  Server,
  Tag,
  Link2,
  ArrowLeft,
  FileText,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface FooterLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const userNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/catalog', label: 'Catalog', icon: Package },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/billing', label: 'Billing', icon: Wallet },
  { href: '/support', label: 'Support', icon: MessageSquare },
  { href: '/guide', label: 'Guide', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/deposits', label: 'Deposits', icon: Wallet },
  { href: '/admin/services', label: 'Services', icon: Package },
  { href: '/admin/landings', label: 'Landings', icon: FileText },
  { href: '/admin/providers', label: 'Providers', icon: Server },
  { href: '/admin/support', label: 'Support', icon: MessageSquare },
  { href: '/admin/coupons', label: 'Coupons', icon: Tag },
  { href: '/admin/referrals', label: 'Tracking', icon: Link2 },
  { href: '/admin/docs', label: 'Documentation', icon: BookOpen },
];

export const adminFooterLink: FooterLink = {
  href: '/dashboard',
  label: 'Back to Panel',
  icon: ArrowLeft,
};
