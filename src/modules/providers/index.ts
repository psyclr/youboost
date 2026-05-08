export type { ProvidersService, ProvidersServiceDeps } from './providers.service';
export { createProvidersService } from './providers.service';
export type { ProvidersRepository } from './providers.repository';
export { createProvidersRepository } from './providers.repository';
export type { ProviderSelector, SelectedProvider, ProviderSelectorDeps } from './provider-selector';
export { createProviderSelector } from './provider-selector';
export type { EncryptionService, EncryptionServiceDeps } from './utils/encryption';
export { createEncryptionService } from './utils/encryption';
export { createSmmApiClient } from './utils/smm-api-client';
export { requireAdmin } from './providers.middleware';
export type { ProviderRoutesDeps } from './providers.routes';
export { createProviderRoutes } from './providers.routes';

// Transitional shims for unconverted callers (orders workers, admin service).
// Delete in sweep phase (F15/F16) once callers convert to factory DI.
import { getPrisma } from '../../shared/database';
import { getConfig } from '../../shared/config';
import { createServiceLogger } from '../../shared/utils/logger';
import { createProvidersRepository } from './providers.repository';
import { createEncryptionService } from './utils/encryption';
import { createProviderSelector, type SelectedProvider } from './provider-selector';
import type { ProviderRecord } from './providers.types';
import type { EncryptionService } from './utils/encryption';
import type { ProviderSelector } from './provider-selector';
import { stubProviderClient as stubClient } from '../orders';

let _encryption: EncryptionService | null = null;
function getEncryption(): EncryptionService {
  if (!_encryption) {
    _encryption = createEncryptionService({
      encryptionKey: getConfig().provider.encryptionKey,
    });
  }
  return _encryption;
}

export function decryptApiKey(encrypted: string): string {
  return getEncryption().decryptApiKey(encrypted);
}

let _selector: ProviderSelector | null = null;
function getSelector(): ProviderSelector {
  if (!_selector) {
    _selector = createProviderSelector({
      providersRepo: createProvidersRepository(getPrisma()),
      encryption: getEncryption(),
      stubClient,
      providerMode: getConfig().provider.mode,
      logger: createServiceLogger('provider-selector'),
    });
  }
  return _selector;
}

export async function selectProviderById(providerId: string): Promise<SelectedProvider> {
  return getSelector().selectProviderById(providerId);
}

// Namespace shim for unconverted callers (orders workers, admin-services.service).
// Only `findProviderById` is currently used externally; expose the full repo
// via a lazy-built instance.
export const providersRepo = {
  findProviderById(id: string): Promise<ProviderRecord | null> {
    return createProvidersRepository(getPrisma()).findProviderById(id);
  },
};
