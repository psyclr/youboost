import type { Logger } from 'pino';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { EncryptionService } from './utils/encryption';
import { createSmmApiClient } from './utils/smm-api-client';
import type { ProviderServiceInfo, ProviderBalanceInfo } from '../orders';
import type { ProvidersRepository } from './providers.repository';
import type {
  CreateProviderInput,
  UpdateProviderInput,
  ProvidersQuery,
  ProviderResponse,
  ProviderDetailed,
  PaginatedProviders,
  ProviderRecord,
} from './providers.types';

export interface ProvidersService {
  createProvider(input: CreateProviderInput): Promise<ProviderResponse>;
  getProvider(id: string): Promise<ProviderDetailed>;
  listProviders(query: ProvidersQuery): Promise<PaginatedProviders>;
  updateProvider(id: string, input: UpdateProviderInput): Promise<ProviderResponse>;
  deactivateProvider(id: string): Promise<void>;
  fetchProviderServices(providerId: string): Promise<ProviderServiceInfo[]>;
  checkProviderBalance(providerId: string): Promise<ProviderBalanceInfo>;
}

export interface ProvidersServiceDeps {
  providersRepo: ProvidersRepository;
  encryption: EncryptionService;
  logger: Logger;
}

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

export function createProvidersService(deps: ProvidersServiceDeps): ProvidersService {
  const { providersRepo, encryption, logger } = deps;

  async function createProvider(input: CreateProviderInput): Promise<ProviderResponse> {
    const encrypted = encryption.encryptApiKey(input.apiKey);

    const record = await providersRepo.createProvider({
      name: input.name,
      apiEndpoint: input.apiEndpoint,
      apiKeyEncrypted: encrypted,
      priority: input.priority,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });

    logger.info({ providerId: record.id }, 'Provider created');
    return mapToResponse(record);
  }

  async function getProvider(id: string): Promise<ProviderDetailed> {
    const record = await providersRepo.findProviderById(id);
    if (!record) {
      throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
    }
    return mapToDetailed(record);
  }

  async function listProviders(query: ProvidersQuery): Promise<PaginatedProviders> {
    const filters: { page: number; limit: number; isActive?: boolean } = {
      page: query.page,
      limit: query.limit,
    };
    if (query.isActive !== undefined) {
      filters.isActive = query.isActive;
    }
    const { providers, total } = await providersRepo.findProviders(filters);

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

  async function updateProvider(id: string, input: UpdateProviderInput): Promise<ProviderResponse> {
    const existing = await providersRepo.findProviderById(id);
    if (!existing) {
      throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.apiEndpoint !== undefined) updateData.apiEndpoint = input.apiEndpoint;
    if (input.apiKey !== undefined)
      updateData.apiKeyEncrypted = encryption.encryptApiKey(input.apiKey);
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const updated = await providersRepo.updateProvider(id, updateData);

    logger.info({ providerId: id }, 'Provider updated');
    return mapToResponse(updated);
  }

  async function deactivateProvider(id: string): Promise<void> {
    const existing = await providersRepo.findProviderById(id);
    if (!existing) {
      throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
    }

    await providersRepo.updateProvider(id, { isActive: false });
    logger.info({ providerId: id }, 'Provider deactivated');
  }

  async function fetchProviderServices(providerId: string): Promise<ProviderServiceInfo[]> {
    const provider = await providersRepo.findProviderById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
    }
    try {
      const apiKey = encryption.decryptApiKey(provider.apiKeyEncrypted);
      const client = createSmmApiClient({ apiEndpoint: provider.apiEndpoint, apiKey });
      return await client.fetchServices();
    } catch (error) {
      logger.warn({ providerId, error }, 'Failed to fetch provider services');
      throw new ValidationError(
        'Provider API key is not configured or invalid',
        'PROVIDER_API_ERROR',
      );
    }
  }

  async function checkProviderBalance(providerId: string): Promise<ProviderBalanceInfo> {
    const provider = await providersRepo.findProviderById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found', 'PROVIDER_NOT_FOUND');
    }
    try {
      const apiKey = encryption.decryptApiKey(provider.apiKeyEncrypted);
      const client = createSmmApiClient({ apiEndpoint: provider.apiEndpoint, apiKey });
      return await client.checkBalance();
    } catch (error) {
      logger.warn({ providerId, error }, 'Failed to check provider balance');
      throw new ValidationError(
        'Provider API key is not configured or invalid',
        'PROVIDER_API_ERROR',
      );
    }
  }

  return {
    createProvider,
    getProvider,
    listProviders,
    updateProvider,
    deactivateProvider,
    fetchProviderServices,
    checkProviderBalance,
  };
}
