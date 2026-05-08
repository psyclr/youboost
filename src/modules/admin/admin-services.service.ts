import type { Logger } from 'pino';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { ServicesRepository, ServiceRecord } from '../orders';
import type { ProvidersRepository } from '../providers';
import type {
  AdminServicesQuery,
  AdminServiceCreateInput,
  AdminServiceUpdateInput,
  AdminServiceResponse,
} from './admin.types';

interface ServiceWithProvider extends ServiceRecord {
  provider?: { id: string; name: string } | null;
}

export interface AdminServicesService {
  listAllServices(query: AdminServicesQuery): Promise<{
    services: AdminServiceResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  createService(input: AdminServiceCreateInput): Promise<AdminServiceResponse>;
  updateService(serviceId: string, input: AdminServiceUpdateInput): Promise<AdminServiceResponse>;
  deactivateService(serviceId: string): Promise<void>;
}

export interface AdminServicesServiceDeps {
  servicesRepo: ServicesRepository;
  providersRepo: ProvidersRepository;
  logger: Logger;
}

export function createAdminServicesService(deps: AdminServicesServiceDeps): AdminServicesService {
  const { servicesRepo, providersRepo, logger } = deps;

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

  async function listAllServices(query: AdminServicesQuery): Promise<{
    services: AdminServiceResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { services, total } = await servicesRepo.findAllServicesPaginatedWithProvider(
      query.page,
      query.limit,
    );
    const totalPages = Math.ceil(total / query.limit);

    logger.info({ page: query.page, total }, 'Listed all services');

    return {
      services: services.map(toServiceResponse),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async function createService(input: AdminServiceCreateInput): Promise<AdminServiceResponse> {
    const provider = await providersRepo.findProviderById(input.providerId);
    if (!provider) {
      throw new ValidationError('Provider not found', 'PROVIDER_NOT_FOUND');
    }

    const record = await servicesRepo.createService({
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

    const withProvider = await servicesRepo.findServiceWithProvider(record.id);

    logger.info({ serviceId: record.id }, 'Created service');

    return toServiceResponse(withProvider ?? record);
  }

  async function updateService(
    serviceId: string,
    input: AdminServiceUpdateInput,
  ): Promise<AdminServiceResponse> {
    const existing = await servicesRepo.findServiceById(serviceId);
    if (!existing) {
      throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
    }

    if (input.providerId) {
      const provider = await providersRepo.findProviderById(input.providerId);
      if (!provider) {
        throw new ValidationError('Provider not found', 'PROVIDER_NOT_FOUND');
      }
    }

    await servicesRepo.updateService(serviceId, input);
    const withProvider = await servicesRepo.findServiceWithProvider(serviceId);

    logger.info({ serviceId }, 'Updated service');

    return toServiceResponse(withProvider ?? existing);
  }

  async function deactivateService(serviceId: string): Promise<void> {
    const existing = await servicesRepo.findServiceById(serviceId);
    if (!existing) {
      throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
    }

    await servicesRepo.deactivateService(serviceId);

    logger.info({ serviceId }, 'Deactivated service');
  }

  return { listAllServices, createService, updateService, deactivateService };
}
