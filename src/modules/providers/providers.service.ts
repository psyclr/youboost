import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { encryptApiKey, decryptApiKey } from './utils/encryption';
import { createSmmApiClient } from './utils/smm-api-client';
import type { ProviderServiceInfo, ProviderBalanceInfo } from '../orders/utils/provider-client';
import * as providerRepo from './providers.repository';
import type {
  CreateProviderInput,
  UpdateProviderInput,
  ProvidersQuery,
  ProviderResponse,
  ProviderDetailed,
  PaginatedProviders,
  ProviderRecord,
} from './providers.types';

const log = createServiceLogger('providers');

function mapToResponse(record: ProviderRecord): ProviderResponse {
  return {
    providerId: record.id,
    name: record.name,
    apiEndpoint: record.apiEndpoint,
    isActive: record.isActive,
    priority: record.priority,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapToDetailed(record: ProviderRecord): ProviderDetailed {
  return {
    ...mapToResponse(record),
    balance: record.balance ? record.balance.toNumber() : null,
    metadata: record.metadata,
  };
}

export async function createProvider(input: CreateProviderInput): Promise<ProviderResponse> {
  const encrypted = encryptApiKey(input.apiKey);

  const record = await providerRepo.createProvider({
    name: input.name,
    apiEndpoint: input.apiEndpoint,
    apiKeyEncrypted: encrypted,
    priority: input.priority,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });

  log.info({ providerId: record.id }, 'Provider created');
  return mapToResponse(record);
}

export async function getProvider(id: string): Promise<ProviderDetailed> {
  const record = await providerRepo.findProviderById(id);
  if (!record) {
    throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
  }
  return mapToDetailed(record);
}

export async function listProviders(query: ProvidersQuery): Promise<PaginatedProviders> {
  const filters: { page: number; limit: number; isActive?: boolean } = {
    page: query.page,
    limit: query.limit,
  };
  if (query.isActive !== undefined) {
    filters.isActive = query.isActive;
  }
  const { providers, total } = await providerRepo.findProviders(filters);

  return {
    providers: providers.map(mapToResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function updateProvider(
  id: string,
  input: UpdateProviderInput,
): Promise<ProviderResponse> {
  const existing = await providerRepo.findProviderById(id);
  if (!existing) {
    throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.apiEndpoint !== undefined) updateData.apiEndpoint = input.apiEndpoint;
  if (input.apiKey !== undefined) updateData.apiKeyEncrypted = encryptApiKey(input.apiKey);
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const updated = await providerRepo.updateProvider(id, updateData);

  log.info({ providerId: id }, 'Provider updated');
  return mapToResponse(updated);
}

export async function deactivateProvider(id: string): Promise<void> {
  const existing = await providerRepo.findProviderById(id);
  if (!existing) {
    throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
  }

  await providerRepo.updateProvider(id, { isActive: false });
  log.info({ providerId: id }, 'Provider deactivated');
}

export async function fetchProviderServices(providerId: string): Promise<ProviderServiceInfo[]> {
  const provider = await providerRepo.findProviderById(providerId);
  if (!provider) {
    throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
  }
  try {
    const apiKey = decryptApiKey(provider.apiKeyEncrypted);
    const client = createSmmApiClient({ apiEndpoint: provider.apiEndpoint, apiKey });
    return await client.fetchServices();
  } catch (error) {
    log.warn({ providerId, error }, 'Failed to fetch provider services');
    throw new ValidationError(
      'Provider API key is not configured or invalid',
      'PROVIDER_API_ERROR',
    );
  }
}

export async function checkProviderBalance(providerId: string): Promise<ProviderBalanceInfo> {
  const provider = await providerRepo.findProviderById(providerId);
  if (!provider) {
    throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
  }
  try {
    const apiKey = decryptApiKey(provider.apiKeyEncrypted);
    const client = createSmmApiClient({ apiEndpoint: provider.apiEndpoint, apiKey });
    return await client.checkBalance();
  } catch (error) {
    log.warn({ providerId, error }, 'Failed to check provider balance');
    throw new ValidationError(
      'Provider API key is not configured or invalid',
      'PROVIDER_API_ERROR',
    );
  }
}
