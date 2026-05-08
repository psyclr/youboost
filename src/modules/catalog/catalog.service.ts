import type { Logger } from 'pino';
import { NotFoundError } from '../../shared/errors';
import type { CachePort } from '../../shared/cache/cache.port';
import type { CatalogRepository } from './catalog.repository';
import type { CatalogQuery, CatalogServiceResponse, PaginatedCatalog } from './catalog.types';
import type { ServiceRecord } from '../orders';

const CACHE_TTL = 300;

export interface CatalogService {
  listServices(query: CatalogQuery): Promise<PaginatedCatalog>;
  getService(serviceId: string): Promise<CatalogServiceResponse>;
}

export interface CatalogServiceDeps {
  catalogRepo: CatalogRepository;
  cache: CachePort;
  logger: Logger;
}

function mapToResponse(record: ServiceRecord): CatalogServiceResponse {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    platform: record.platform,
    type: record.type,
    pricePer1000: record.pricePer1000.toNumber(),
    minQuantity: record.minQuantity,
    maxQuantity: record.maxQuantity,
    refillDays: record.refillDays,
  };
}

export function createCatalogService(deps: CatalogServiceDeps): CatalogService {
  const { catalogRepo, cache, logger } = deps;

  async function listServices(query: CatalogQuery): Promise<PaginatedCatalog> {
    const cacheKey = `catalog:list:${query.platform ?? 'all'}:${query.type ?? 'all'}:${query.page}:${query.limit}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Cache hit for catalog list');
      return JSON.parse(cached) as PaginatedCatalog;
    }

    const { services, total } = await catalogRepo.findActiveServices({
      platform: query.platform,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });

    const result: PaginatedCatalog = {
      services: services.map(mapToResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };

    await cache.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    logger.debug({ cacheKey }, 'Cached catalog list');

    return result;
  }

  async function getService(serviceId: string): Promise<CatalogServiceResponse> {
    const cacheKey = `catalog:service:${serviceId}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Cache hit for catalog service');
      return JSON.parse(cached) as CatalogServiceResponse;
    }

    const record = await catalogRepo.findActiveServiceById(serviceId);
    if (!record) {
      throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
    }

    const result = mapToResponse(record);
    await cache.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    logger.debug({ cacheKey }, 'Cached catalog service');

    return result;
  }

  return { listServices, getService };
}
