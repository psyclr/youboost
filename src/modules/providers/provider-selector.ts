import type { Logger } from 'pino';
import { ValidationError } from '../../shared/errors';
import type { ProviderClient } from '../orders';
import type { EncryptionService } from './utils/encryption';
import type { ProvidersRepository } from './providers.repository';
import { createSmmApiClient } from './utils/smm-api-client';

export interface SelectedProvider {
  providerId: string | null;
  client: ProviderClient;
}

export interface ProviderSelector {
  selectProvider(): Promise<SelectedProvider>;
  selectProviderById(providerId: string): Promise<SelectedProvider>;
}

export interface ProviderSelectorDeps {
  providersRepo: ProvidersRepository;
  encryption: EncryptionService;
  stubClient: ProviderClient;
  providerMode: 'stub' | 'real';
  logger: Logger;
}

export function createProviderSelector(deps: ProviderSelectorDeps): ProviderSelector {
  const { providersRepo, encryption, stubClient, providerMode, logger } = deps;

  const STUB_PROVIDER: SelectedProvider = {
    providerId: null,
    client: stubClient,
  };

  async function selectProvider(): Promise<SelectedProvider> {
    if (providerMode === 'stub') {
      return STUB_PROVIDER;
    }

    const providers = await providersRepo.findActiveProvidersByPriority();

    if (providers.length === 0) {
      logger.warn('No active providers found, falling back to stub');
      return STUB_PROVIDER;
    }

    const provider = providers[0] as (typeof providers)[0];
    const apiKey = encryption.decryptApiKey(provider.apiKeyEncrypted);
    const client = createSmmApiClient({
      apiEndpoint: provider.apiEndpoint,
      apiKey,
    });

    return {
      providerId: provider.id,
      client,
    };
  }

  async function selectProviderById(providerId: string): Promise<SelectedProvider> {
    if (providerMode === 'stub') {
      return STUB_PROVIDER;
    }

    const provider = await providersRepo.findProviderById(providerId);
    if (!provider?.isActive) {
      throw new ValidationError('Linked provider is not available', 'PROVIDER_UNAVAILABLE');
    }

    const apiKey = encryption.decryptApiKey(provider.apiKeyEncrypted);
    const client = createSmmApiClient({
      apiEndpoint: provider.apiEndpoint,
      apiKey,
    });

    return {
      providerId: provider.id,
      client,
    };
  }

  return { selectProvider, selectProviderById };
}
