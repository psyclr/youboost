import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as serviceRepo from '../orders/service.repository';
import { toNumber } from '../billing/utils/decimal';
import type { ServiceRecord } from '../orders/orders.types';
import type {
  AdminServiceCreateInput,
  AdminServiceUpdateInput,
  AdminServiceResponse,
} from './admin.types';

const log = createServiceLogger('admin-services');

function toServiceResponse(record: ServiceRecord): AdminServiceResponse {
  return {
    serviceId: record.id,
    name: record.name,
    description: record.description,
    platform: record.platform,
    type: record.type,
    pricePer1000: toNumber(record.pricePer1000),
    minQuantity: record.minQuantity,
    maxQuantity: record.maxQuantity,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listAllServices(): Promise<{ services: AdminServiceResponse[] }> {
  const services = await serviceRepo.findAllServices();

  log.info({ count: services.length }, 'Listed all services');

  return { services: services.map(toServiceResponse) };
}

export async function createService(input: AdminServiceCreateInput): Promise<AdminServiceResponse> {
  const record = await serviceRepo.createService({
    name: input.name,
    description: input.description,
    platform: input.platform,
    type: input.type,
    pricePer1000: input.pricePer1000,
    minQuantity: input.minQuantity,
    maxQuantity: input.maxQuantity,
  });

  log.info({ serviceId: record.id }, 'Created service');

  return toServiceResponse(record);
}

export async function updateService(
  serviceId: string,
  input: AdminServiceUpdateInput,
): Promise<AdminServiceResponse> {
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  const record = await serviceRepo.updateService(serviceId, input);

  log.info({ serviceId }, 'Updated service');

  return toServiceResponse(record);
}

export async function deactivateService(serviceId: string): Promise<void> {
  const existing = await serviceRepo.findServiceById(serviceId);
  if (!existing) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  await serviceRepo.deactivateService(serviceId);

  log.info({ serviceId }, 'Deactivated service');
}
