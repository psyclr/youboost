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

// Transitional namespace shim for unconverted callers (admin-services.service).
// Only `findProviderById` is currently used externally; expose the full repo
// via a lazy-built instance. Delete when admin converts.
import { getPrisma } from '../../shared/database';
import { createProvidersRepository } from './providers.repository';
import type { ProviderRecord } from './providers.types';

export const providersRepo = {
  findProviderById(id: string): Promise<ProviderRecord | null> {
    return createProvidersRepository(getPrisma()).findProviderById(id);
  },
};
