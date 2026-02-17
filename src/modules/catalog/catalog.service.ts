import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { getRedis } from '../../shared/redis/redis';
import * as catalogRepo from './catalog.repository';
import type { CatalogQuery, CatalogServiceResponse, PaginatedCatalog } from './catalog.types';
import type { ServiceRecord } from '../orders/orders.types';

const log = createServiceLogger('catalog');

const CACHE_TTL = 300;

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
  };
}

export async function listServices(query: CatalogQuery): Promise<PaginatedCatalog> {
  const cacheKey = `catalog:list:${query.platform ?? 'all'}:${query.type ?? 'all'}:${query.page}:${query.limit}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached) {
    log.debug({ cacheKey }, 'Cache hit for catalog list');
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

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  log.debug({ cacheKey }, 'Cached catalog list');

  return result;
}

export async function getService(serviceId: string): Promise<CatalogServiceResponse> {
  const cacheKey = `catalog:service:${serviceId}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached) {
    log.debug({ cacheKey }, 'Cache hit for catalog service');
    return JSON.parse(cached) as CatalogServiceResponse;
  }

  const record = await catalogRepo.findActiveServiceById(serviceId);
  if (!record) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  const result = mapToResponse(record);
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  log.debug({ cacheKey }, 'Cached catalog service');

  return result;
}
