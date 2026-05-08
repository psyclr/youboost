import type { TrackingRepository } from '../tracking.repository';
import type { TrackingLink } from '../../../generated/prisma';
import type { TrackingLinkWithStats } from '../tracking.types';

export function createFakeTrackingRepository(
  seed: {
    links?: TrackingLink[];
    stats?: TrackingLinkWithStats[];
  } = {},
): TrackingRepository & {
  calls: {
    create: Array<{ code: string; name: string }>;
    findAll: number;
    findById: string[];
    findByCode: string[];
    deleteById: string[];
  };
} {
  const byId = new Map((seed.links ?? []).map((l) => [l.id, l]));
  const byCode = new Map((seed.links ?? []).map((l) => [l.code, l]));
  const calls = {
    create: [] as Array<{ code: string; name: string }>,
    findAll: 0,
    findById: [] as string[],
    findByCode: [] as string[],
    deleteById: [] as string[],
  };

  return {
    async create(data) {
      calls.create.push(data);
      const link: TrackingLink = {
        id: `link-${byId.size + 1}`,
        code: data.code,
        name: data.name,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      byId.set(link.id, link);
      byCode.set(link.code, link);
      return link;
    },
    async findAll() {
      calls.findAll += 1;
      return seed.stats ?? [];
    },
    async findById(id) {
      calls.findById.push(id);
      return byId.get(id) ?? null;
    },
    async findByCode(code) {
      calls.findByCode.push(code);
      return byCode.get(code) ?? null;
    },
    async deleteById(id) {
      calls.deleteById.push(id);
      byId.delete(id);
    },
    calls,
  };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
