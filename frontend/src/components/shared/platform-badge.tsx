import { Badge } from '@/components/ui/badge';
import type { Platform } from '@/lib/api/types';
import { PLATFORM_BY_ID } from '@/lib/constants/platforms';

export function PlatformBadge({ platform }: Readonly<{ platform: Platform }>) {
  const config = PLATFORM_BY_ID[platform];
  return (
    <Badge variant="secondary" className={config.badgeClassName}>
      {config.label}
    </Badge>
  );
}
