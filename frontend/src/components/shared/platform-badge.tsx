import { Badge } from '@/components/ui/badge';
import type { Platform } from '@/lib/api/types';

const platformConfig: Record<Platform, { label: string; className: string }> = {
  YOUTUBE: {
    label: 'YouTube',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  INSTAGRAM: {
    label: 'Instagram',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  TIKTOK: {
    label: 'TikTok',
    className: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  },
  TWITTER: {
    label: 'Twitter',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  FACEBOOK: {
    label: 'Facebook',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
};

export function PlatformBadge({ platform }: Readonly<{ platform: Platform }>) {
  const config = platformConfig[platform];
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
