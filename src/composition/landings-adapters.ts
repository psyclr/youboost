import type { CatalogService } from '../modules/catalog/catalog.service';
import type { GuestOrderProcessorPort } from '../modules/billing';
import type {
  ServiceLookupPort,
  ServiceLookupRecord,
} from '../modules/landings/ports/service-lookup.port';
import type {
  AutoUserCreatorPort,
  GuestOrderCreatorPort,
  GuestOrderStripePort,
} from '../modules/landings/ports/guest-checkout.ports';
import type { AuthAutoUserService, AutoUserTicket } from '../modules/auth';
import type { OrdersService } from '../modules/orders';
import type { StripePaymentService } from '../modules/billing';

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

export function createGuestOrderCreatorPort(orders: OrdersService): GuestOrderCreatorPort {
  return {
    createPendingPaymentOrder: (i) => orders.createPendingPaymentOrder(i),
    attachStripeSessionId: (orderId, sessionId) => orders.attachStripeSessionId(orderId, sessionId),
  };
}

export function createGuestOrderStripePort(stripe: StripePaymentService): GuestOrderStripePort {
  return {
    createGuestOrderSession: (i) => stripe.createGuestOrderSession(i),
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
