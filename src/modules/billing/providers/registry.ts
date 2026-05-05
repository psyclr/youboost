import { stripeProvider } from '../stripe/stripe.service';
import { cryptomusProvider } from '../cryptomus/cryptomus.service';
import type { PaymentProvider, PaymentProviderId } from './types';

const providers: readonly PaymentProvider[] = [stripeProvider, cryptomusProvider];

export function getPaymentProviders(): readonly PaymentProvider[] {
  return providers;
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  const provider = providers.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Unknown payment provider: ${id}`);
  }
  return provider;
}
