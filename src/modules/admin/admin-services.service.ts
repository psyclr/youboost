import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { serviceRepo, type ServiceRecord } from '../orders';
import { providersRepo } from '../providers';
import type {
  AdminServicesQuery,
  AdminServiceCreateInput,
  AdminServiceUpdateInput,
  AdminServiceResponse,
} from './admin.types';

const log = createServiceLogger('admin-services');

interface ServiceWithProvider extends ServiceRecord {
  provider?: { id: string; name: string } | null;
}

function toServiceResponse(record: ServiceWithProvider): AdminServiceResponse {
  return {
    serviceId: record.id,
    name: record.name,
    description: record.description,
    platform: record.platform,
    type: record.type,
    pricePer1000: Number(record.pricePer1000),
    minQuantity: record.minQuantity,
    maxQuantity: record.maxQuantity,
    isActive: record.isActive,
    providerId: record.providerId,
    externalServiceId: record.externalServiceId,
    providerName: record.provider?.name ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listAllServices(query: AdminServicesQuery): Promise<{
  services: AdminServiceResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { services, total } = await serviceRepo.findAllServicesPaginatedWithProvider(
    query.page,
    query.limit,
  );
  const totalPages = Math.ceil(total / query.limit);

  log.info({ page: query.page, total }, 'Listed all services');

  return {
    services: services.map(toServiceResponse),
    pagination: { page: query.page, limit: query.limit, total, totalPages },
  };
}

export async function createService(input: AdminServiceCreateInput): Promise<AdminServiceResponse> {
  const provider = await providersRepo.findProviderById(input.providerId);
  if (!provider) {
    throw new ValidationError('Provider not found', 'PROVIDER_NOT_FOUND');
  }

  const record = await serviceRepo.createService({
    name: input.name,
    description: input.description,
    platform: input.platform,
    type: input.type,
    pricePer1000: input.pricePer1000,
    minQuantity: input.minQuantity,
    maxQuantity: input.maxQuantity,
    providerId: input.providerId,
    externalServiceId: input.externalServiceId,
  });

  const withProvider = await serviceRepo.findServiceWithProvider(record.id);

  log.info({ serviceId: record.id }, 'Created service');

  return toServiceResponse(withProvider ?? record);
}

export async function updateService(
  serviceId: string,
  input: AdminServiceUpdateInput,
): Promise<AdminServiceResponse> {
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  if (input.providerId) {
    const provider = await providersRepo.findProviderById(input.providerId);
    if (!provider) {
      throw new ValidationError('Provider not found', 'PROVIDER_NOT_FOUND');
    }
  }

  await serviceRepo.updateService(serviceId, input);
  const withProvider = await serviceRepo.findServiceWithProvider(serviceId);

  log.info({ serviceId }, 'Updated service');

  return toServiceResponse(withProvider ?? existing);
}

export async function deactivateService(serviceId: string): Promise<void> {
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  await serviceRepo.deactivateService(serviceId);

  log.info({ serviceId }, 'Deactivated service');
}
