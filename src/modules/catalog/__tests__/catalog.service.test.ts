import { createCatalogService } from '../catalog.service';
import { createFakeCatalogRepository, createFakeCache, silentLogger } from './fakes';
import type { ServiceRecord } from '../../orders';

function makeServiceRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: 'svc-1',
    name: 'YouTube Views',
    description: 'High quality views',
    platform: 'YOUTUBE',
    type: 'VIEWS',
    pricePer1000: { toNumber: (): number => 5.0 },
    minQuantity: 100,
    maxQuantity: 100000,
    isActive: true,
    refillDays: null,
    providerId: null,
    externalServiceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const expectedResponse = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'High quality views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: 5.0,
  minQuantity: 100,
  maxQuantity: 100000,
  refillDays: null,
};

describe('Catalog Service', () => {
  describe('listServices', () => {
    const defaultQuery = { page: 1, limit: 20 };

    it('returns cached data on cache hit without hitting repo', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const cachedData = {
        services: [expectedResponse],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      await cache.setex('catalog:list:all:all:1:20', 300, JSON.stringify(cachedData));
      cache.calls.setex.length = 0; // Reset after priming
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      const result = await service.listServices(defaultQuery);

      expect(result).toEqual(cachedData);
      expect(catalogRepo.calls.findActiveServices).toHaveLength(0);
      expect(cache.calls.get).toEqual(['catalog:list:all:all:1:20']);
    });

    it('queries repo and caches on cache miss', async () => {
      const catalogRepo = createFakeCatalogRepository({ services: [makeServiceRecord()] });
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      const result = await service.listServices(defaultQuery);

      expect(result.services).toHaveLength(1);
      expect(result.services[0]).toEqual(expectedResponse);
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(catalogRepo.calls.findActiveServices[0]).toEqual({
        platform: undefined,
        type: undefined,
        page: 1,
        limit: 20,
      });
      expect(cache.calls.setex[0]).toEqual({
        key: 'catalog:list:all:all:1:20',
        ttl: 300,
        value: JSON.stringify(result),
      });
    });

    it('uses correct cache key with platform filter', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await service.listServices({ page: 1, limit: 20, platform: 'YOUTUBE' });

      expect(cache.calls.get).toEqual(['catalog:list:YOUTUBE:all:1:20']);
    });

    it('uses correct cache key with type filter', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await service.listServices({ page: 1, limit: 20, type: 'VIEWS' });

      expect(cache.calls.get).toEqual(['catalog:list:all:VIEWS:1:20']);
    });

    it('uses correct cache key with both filters', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await service.listServices({ page: 2, limit: 10, platform: 'INSTAGRAM', type: 'LIKES' });

      expect(cache.calls.get).toEqual(['catalog:list:INSTAGRAM:LIKES:2:10']);
    });

    it('caches with 300 second TTL', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await service.listServices(defaultQuery);

      expect(cache.calls.setex[0]?.ttl).toBe(300);
    });

    it('calculates totalPages correctly', async () => {
      const catalogRepo = createFakeCatalogRepository({
        services: Array.from({ length: 45 }, (_, i) =>
          makeServiceRecord({ id: `svc-${i}`, name: `Service ${i}` }),
        ),
      });
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      const result = await service.listServices({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.total).toBe(45);
    });

    it('returns empty result on cache miss with no data', async () => {
      const catalogRepo = createFakeCatalogRepository({ services: [] });
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      const result = await service.listServices(defaultQuery);

      expect(result.services).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getService', () => {
    const serviceId = '550e8400-e29b-41d4-a716-446655440000';

    it('returns cached data on cache hit', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      await cache.setex(`catalog:service:${serviceId}`, 300, JSON.stringify(expectedResponse));
      cache.calls.setex.length = 0;
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      const result = await service.getService(serviceId);

      expect(result).toEqual(expectedResponse);
      expect(catalogRepo.calls.findActiveServiceById).toHaveLength(0);
    });

    it('queries repo and caches on cache miss when found', async () => {
      const byId = new Map([[serviceId, makeServiceRecord({ id: serviceId })]]);
      const catalogRepo = createFakeCatalogRepository({ byId });
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      const result = await service.getService(serviceId);

      expect(result).toEqual({ ...expectedResponse, id: serviceId });
      expect(catalogRepo.calls.findActiveServiceById).toEqual([serviceId]);
      expect(cache.calls.setex[0]?.key).toBe(`catalog:service:${serviceId}`);
    });

    it('throws NotFoundError on cache miss when not found', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await expect(service.getService(serviceId)).rejects.toThrow('Service not found');
    });

    it('does not cache when service is not found', async () => {
      const catalogRepo = createFakeCatalogRepository();
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await expect(service.getService(serviceId)).rejects.toThrow();

      expect(cache.calls.setex).toHaveLength(0);
    });

    it('caches with 300 second TTL', async () => {
      const byId = new Map([[serviceId, makeServiceRecord({ id: serviceId })]]);
      const catalogRepo = createFakeCatalogRepository({ byId });
      const cache = createFakeCache();
      const service = createCatalogService({ catalogRepo, cache, logger: silentLogger });

      await service.getService(serviceId);

      expect(cache.calls.setex[0]?.ttl).toBe(300);
    });
  });
});
