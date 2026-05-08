import type { PaymentProvider, PaymentProviderId } from './types';

export interface PaymentProviderRegistry {
  getAll(): readonly PaymentProvider[];
  get(id: PaymentProviderId): PaymentProvider;
}

export function createPaymentProviderRegistry(
  providers: readonly PaymentProvider[],
): PaymentProviderRegistry {
  const list: readonly PaymentProvider[] = providers;

  function getAll(): readonly PaymentProvider[] {
    return list;
  }

  function get(id: PaymentProviderId): PaymentProvider {
    const provider = list.find((p) => p.id === id);
    if (!provider) {
      throw new Error(`Unknown payment provider: ${id}`);
    }
    return provider;
  }

  return { getAll, get };
}
