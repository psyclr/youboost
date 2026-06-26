import type { CatalogService } from '../modules/catalog/catalog.service';
import type { OrderPaymentProcessorPort } from '../modules/billing';
import type { PaymentRepository } from '../modules/billing';
import type {
  ServiceLookupPort,
  ServiceLookupRecord,
} from '../modules/landings/ports/service-lookup.port';
import type {
  AutoUserCreatorPort,
  GuestOrderCreatorPort,
  GuestOrderPaymentPort,
} from '../modules/landings/ports/guest-checkout.ports';
import type { AuthAutoUserService, AutoUserTicket } from '../modules/auth';
import type { CryptomusPaymentService, StripePaymentService } from '../modules/billing';

export function createLandingServiceLookup(catalog: CatalogService): ServiceLookupPort {
  return {
    async getService(serviceId): Promise<ServiceLookupRecord> {
      const svc = await catalog.getService(serviceId);
      return {
        id: svc.id,
        name: svc.name,
        pricePer1000: svc.pricePer1000,
        minQuantity: svc.minQuantity,
        maxQuantity: svc.maxQuantity,
      };
    },
  };
}

export function createAutoUserCreatorPort(autoUser: AuthAutoUserService): AutoUserCreatorPort {
  return {
    async createAutoUser(email): Promise<{ userId: string; email: string; fresh: boolean }> {
      const t: AutoUserTicket = await autoUser.createAutoUser(email);
      return { userId: t.userId, email: t.email, fresh: t.fresh };
    },
  };
}

export function createGuestOrderCreatorPort(payments: PaymentRepository): GuestOrderCreatorPort {
  return {
    createPaymentWithOrders: (i) => payments.createPaymentWithOrders(i),
    attachPaymentSession: (paymentId, providerSessionId) =>
      payments.attachSession(paymentId, providerSessionId),
  };
}

export function createGuestOrderPaymentPort(
  stripe: StripePaymentService,
  cryptomus: CryptomusPaymentService,
): GuestOrderPaymentPort {
  return {
    createPaymentSession: (i): Promise<{ sessionId: string; url: string }> => {
      if (i.provider === 'cryptomus') return cryptomus.createPaymentSession(i);
      return stripe.createPaymentSession(i);
    },
  };
}

/**
 * Pick the real or fake guest payment port based on the PAYMENTS_FAKE flag.
 * Keeps the composition root a single call (no env branching inline).
 */
export function selectGuestPaymentPort(
  fake: boolean,
  stripe: StripePaymentService,
  cryptomus: CryptomusPaymentService,
): GuestOrderPaymentPort {
  return fake ? createFakeGuestPaymentPort() : createGuestOrderPaymentPort(stripe, cryptomus);
}

/**
 * Test-only guest payment port: returns a deterministic checkout URL on the
 * provider's real (trusted) host WITHOUT calling Stripe/Cryptomus. Lets the
 * isolated e2e stack exercise the real checkout flow (auto-user, Payment,
 * orders, session attach) up to the redirect, with no external dependency.
 * Wired only when PAYMENTS_FAKE is set — never in prod.
 */
export function createFakeGuestPaymentPort(): GuestOrderPaymentPort {
  return {
    createPaymentSession: (i): Promise<{ sessionId: string; url: string }> => {
      const sessionId = `fake-${i.reference.kind}-${Date.now()}`;
      const host =
        i.provider === 'cryptomus' ? 'https://pay.cryptomus.com' : 'https://checkout.stripe.com';
      return Promise.resolve({ sessionId, url: `${host}/fake/${sessionId}` });
    },
  };
}

/**
 * Late-binding settlement port for the new multi-service Payment path —
 * `ordersService.confirmOrderPayment` is created after the billing services,
 * so the composition root binds it once available. Used by the
 * PaymentCompletionRouter cutover (additive; not yet routed by webhooks).
 */
export interface LateBoundOrderPaymentProcessor {
  port: OrderPaymentProcessorPort;
  bind(impl: OrderPaymentProcessorPort): void;
}

export function createLateBoundOrderPaymentProcessor(): LateBoundOrderPaymentProcessor {
  let ref: OrderPaymentProcessorPort | null = null;
  return {
    port: {
      async confirmOrderPayment(paymentId): Promise<void> {
        if (!ref) throw new Error('orderPaymentProcessor not bound yet');
        await ref.confirmOrderPayment(paymentId);
      },
    },
    bind(impl): void {
      ref = impl;
    },
  };
}
