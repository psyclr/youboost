import { getConfig } from '../../shared/config';
import { ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import type { ProviderClient } from '../orders/utils/provider-client';
import { providerClient as stubClient } from '../orders/utils/stub-provider-client';
import { findActiveProvidersByPriority, findProviderById } from './providers.repository';
import { decryptApiKey } from './utils/encryption';
import { createSmmApiClient } from './utils/smm-api-client';

const log = createServiceLogger('provider-selector');

export interface SelectedProvider {
  providerId: string | null;
  client: ProviderClient;
}

const STUB_PROVIDER: SelectedProvider = {
  providerId: null,
  client: stubClient,
};

export async function selectProvider(): Promise<SelectedProvider> {
  if (getConfig().provider.mode === 'stub') {
    return STUB_PROVIDER;
  }

  const providers = await findActiveProvidersByPriority();

  if (providers.length === 0) {
    log.warn('No active providers found, falling back to stub');
    return STUB_PROVIDER;
  }

  const provider = providers[0] as (typeof providers)[0];
  const apiKey = decryptApiKey(provider.apiKeyEncrypted);
  const client = createSmmApiClient({
    apiEndpoint: provider.apiEndpoint,
    apiKey,
  });

  return {
    providerId: provider.id,
    client,
  };
}

export async function selectProviderById(providerId: string): Promise<SelectedProvider> {
  if (getConfig().provider.mode === 'stub') {
    return STUB_PROVIDER;
  }

  const provider = await findProviderById(providerId);
  if (!provider || !provider.isActive) {
    throw new ValidationError('Linked provider is not available', 'PROVIDER_UNAVAILABLE');
  }

  const apiKey = decryptApiKey(provider.apiKeyEncrypted);
  const client = createSmmApiClient({
    apiEndpoint: provider.apiEndpoint,
    apiKey,
  });

  return {
    providerId: provider.id,
    client,
  };
}
