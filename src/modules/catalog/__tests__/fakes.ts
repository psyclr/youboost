import type { CachePort } from '../../../shared/cache/cache.port';
import type { CatalogRepository } from '../catalog.repository';
import type { ServiceRecord } from '../../orders';

export function createFakeCatalogRepository(
  seed: {
    services?: ServiceRecord[];
    byId?: Map<string, ServiceRecord>;
  } = {},
): CatalogRepository & {
  calls: { findActiveServices: unknown[]; findActiveServiceById: string[] };
} {
  const services = seed.services ?? [];
  const byId = seed.byId ?? new Map();
  const calls = {
    findActiveServices: [] as unknown[],
    findActiveServiceById: [] as string[],
  };

  return {
    async findActiveServices(filters) {
      calls.findActiveServices.push(filters);
      let filtered = services;
      if (filters.platform) filtered = filtered.filter((s) => s.platform === filters.platform);
      if (filters.type) filtered = filtered.filter((s) => s.type === filters.type);
      const total = filtered.length;
      const start = (filters.page - 1) * filters.limit;
      return { services: filtered.slice(start, start + filters.limit), total };
    },
    async findActiveServiceById(serviceId) {
      calls.findActiveServiceById.push(serviceId);
      return byId.get(serviceId) ?? null;
    },
    calls,
  };
}

export function createFakeCache(): CachePort & {
  calls: {
    get: string[];
    setex: Array<{ key: string; ttl: number; value: string }>;
    delete: string[];
  };
} {
  const store = new Map<string, string>();
  const calls = {
    get: [] as string[],
    setex: [] as Array<{ key: string; ttl: number; value: string }>,
    delete: [] as string[],
  };
  return {
    async get(key) {
      calls.get.push(key);
      return store.get(key) ?? null;
    },
    async setex(key, ttl, value) {
      calls.setex.push({ key, ttl, value });
      store.set(key, value);
    },
    async delete(key) {
      calls.delete.push(key);
      store.delete(key);
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
