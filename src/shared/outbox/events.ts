/**
 * All domain events that flow through the transactional outbox.
 * Each event is produced by exactly one module and may have zero or
 * more handlers. Adding an event: extend the union, add a producer in
 * the relevant service (inside a tx), and register a handler factory.
 *
 * Naming: `<aggregate>.<past_tense_verb>` for business events,
 * `<aggregate>.<action>_requested` for commands that trigger work.
 */
export type OutboxEvent =
  // Orders
  | {
      type: 'order.created';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; status: string; price: number };
    }
  | {
      type: 'order.cancelled';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; refundAmount: number };
    }
  | {
      type: 'order.completed';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; remains: number | null };
    }
  | {
      type: 'order.failed';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; reason: string };
    }
  | {
      type: 'order.partial';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { orderId: string; userId: string; remains: number };
    }
  // Payments (a settled checkout = one purchase; reported to analytics server-side)
  | {
      type: 'payment.confirmed';
      aggregateType: 'payment';
      aggregateId: string;
      userId: string;
      payload: {
        paymentId: string;
        userId: string;
        amount: number;
        currency: string;
        /** Metrika ClientID captured at checkout; null when the visitor blocked it. */
        metrikaClientId: string | null;
      };
    }
  // Deposits
  | {
      type: 'deposit.confirmed';
      aggregateType: 'deposit';
      aggregateId: string;
      userId: string;
      payload: {
        depositId: string;
        userId: string;
        amount: number;
        provider: string;
        metrikaClientId: string | null;
      };
    }
  | {
      type: 'deposit.failed';
      aggregateType: 'deposit';
      aggregateId: string;
      userId: string;
      payload: { depositId: string; userId: string; reason: string };
    }
  // User lifecycle
  | {
      // A guest checkout silently provisioned an account; the payload carries the
      // set-password link so the customer can claim it. Distinct from normal
      // registration (which emits user.email_verification_requested instead).
      type: 'user.auto_registered';
      aggregateType: 'user';
      aggregateId: string;
      userId: string;
      payload: { userId: string; email: string; setupUrl: string };
    }
  | {
      type: 'user.email_verification_requested';
      aggregateType: 'user';
      aggregateId: string;
      userId: string;
      payload: { userId: string; email: string; verifyUrl: string };
    }
  | {
      type: 'user.password_reset_requested';
      aggregateType: 'user';
      aggregateId: string;
      userId: string;
      payload: { userId: string; email: string; resetUrl: string };
    }
  // Referrals & coupons
  | {
      type: 'referral.applied';
      aggregateType: 'user';
      aggregateId: string;
      userId: string;
      payload: { userId: string; referralCode: string };
    }
  | {
      type: 'coupon.used';
      aggregateType: 'order';
      aggregateId: string;
      userId: string;
      payload: { couponId: string; orderId: string };
    }
  // Landings (funnel events — some are pre-auth, so userId may be null)
  | {
      type: 'landing.viewed';
      aggregateType: 'landing';
      aggregateId: string;
      userId: string | null;
      payload: { landingId: string; slug: string; userAgent?: string; referrer?: string };
    }
  | {
      type: 'landing.calculator_used';
      aggregateType: 'landing';
      aggregateId: string;
      userId: string | null;
      payload: {
        landingId: string;
        slug: string;
        serviceId: string;
        quantity: number;
        computedPrice: number;
      };
    }
  | {
      type: 'landing.guest_checkout_started';
      aggregateType: 'landing';
      aggregateId: string;
      userId: string;
      payload: {
        landingId: string;
        tierId: string;
        paymentProvider?: 'stripe' | 'cryptomus';
        /** Every order in the cart, so analytics counts the whole checkout. */
        orderIds: string[];
        userId: string;
        email: string;
      };
    }
  | {
      type: 'landing.guest_account_activated';
      aggregateType: 'user';
      aggregateId: string;
      userId: string;
      payload: { userId: string };
    };

export type OutboxEventType = OutboxEvent['type'];

/**
 * Narrow the union to a single event variant by its type tag.
 */
export type OutboxEventOfType<T extends OutboxEventType> = Extract<OutboxEvent, { type: T }>;
