import { Youtube, Instagram, Music2, Twitter, Facebook, type LucideIcon } from 'lucide-react';
import type { Platform } from '@/lib/api/types';

export interface PlatformMeta {
  id: Platform;
  label: string;
  icon: LucideIcon;
  badgeClassName: string;
}

// Single source of truth for platform metadata: label + badge classes (used by
// PlatformBadge and the catalog filter) plus an icon for future consumers.
export const PLATFORMS: PlatformMeta[] = [
  {
    id: 'YOUTUBE',
    label: 'YouTube',
    icon: Youtube,
    badgeClassName: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  {
    id: 'INSTAGRAM',
    label: 'Instagram',
    icon: Instagram,
    badgeClassName: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  {
    id: 'TIKTOK',
    label: 'TikTok',
    icon: Music2,
    badgeClassName: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  },
  {
    id: 'TWITTER',
    label: 'Twitter',
    icon: Twitter,
    badgeClassName: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  {
    id: 'FACEBOOK',
    label: 'Facebook',
    icon: Facebook,
    badgeClassName: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
];

// Lookup map by platform id.
export const PLATFORM_BY_ID: Record<Platform, PlatformMeta> = PLATFORMS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<Platform, PlatformMeta>,
);
