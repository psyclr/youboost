import type { ProviderClient } from '../utils/provider-client';

/**
 * Narrow consumer-side port for selecting an SMM provider client.
 * Defined here (not imported from providers module) because providers
 * module imports ProviderClient type FROM orders — any reverse import
 * creates a cycle.
 */
export interface ProviderSelectorPort {
  selectProviderById(providerId: string): Promise<SelectedProvider>;
  selectProvider(): Promise<SelectedProvider>;
}

export interface SelectedProvider {
  providerId: string | null;
  client: ProviderClient;
}
