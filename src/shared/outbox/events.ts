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
  // Deposits
  | {
      type: 'deposit.confirmed';
      aggregateType: 'deposit';
      aggregateId: string;
      userId: string;
      payload: { depositId: string; userId: string; amount: number; provider: string };
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
      type: 'user.registered';
      aggregateType: 'user';
      aggregateId: string;
      userId: string;
      payload: { userId: string; email: string };
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
    };

export type OutboxEventType = OutboxEvent['type'];

/**
 * Narrow the union to a single event variant by its type tag.
 */
export type OutboxEventOfType<T extends OutboxEventType> = Extract<OutboxEvent, { type: T }>;
