import type { CatalogService } from '../modules/catalog/catalog.service';
import type { GuestOrderProcessorPort, OrderPaymentProcessorPort } from '../modules/billing';
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
import type { OrdersService } from '../modules/orders';
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

export function createGuestOrderCreatorPort(
  orders: OrdersService,
  payments: PaymentRepository,
): GuestOrderCreatorPort {
  return {
    createPendingPaymentOrder: (i) => orders.createPendingPaymentOrder(i),
    attachStripeSessionId: (orderId, sessionId) => orders.attachStripeSessionId(orderId, sessionId),
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
    createGuestOrderSession: (i): Promise<{ sessionId: string; url: string }> => {
      if (i.provider === 'cryptomus') return cryptomus.createGuestOrderSession(i);
      return stripe.createGuestOrderSession(i);
    },
    createPaymentSession: (i): Promise<{ sessionId: string; url: string }> => {
      if (i.provider === 'cryptomus') return cryptomus.createPaymentSession(i);
      return stripe.createPaymentSession(i);
    },
  };
}

/**
 * Late-binding processor — stripePayment is created before ordersService,
 * so we expose a mutable ref that the composition root assigns once
 * ordersService exists. Throws if a Stripe webhook fires before wiring
 * completes (impossible in practice; server hasn't started yet).
 */
export interface LateBoundGuestProcessor {
  port: GuestOrderProcessorPort;
  bind(impl: GuestOrderProcessorPort): void;
}

export function createLateBoundGuestProcessor(): LateBoundGuestProcessor {
  let ref: GuestOrderProcessorPort | null = null;
  return {
    port: {
      async confirmGuestOrderPayment(p): Promise<void> {
        if (!ref) throw new Error('guestOrderProcessor not bound yet');
        await ref.confirmGuestOrderPayment(p);
      },
    },
    bind(impl): void {
      ref = impl;
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
