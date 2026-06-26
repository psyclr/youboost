import { z } from 'zod';

/**
 * Runtime zod schemas for MONEY-CRITICAL API responses only. These guard the
 * fields the UI renders as balances / prices / totals / pay URLs, so a backend
 * contract drift fails closed (a clear INVALID_RESPONSE error) instead of
 * silently rendering NaN/undefined money.
 *
 * Each schema is LOOSE (`.loose()` — passthrough): we validate ONLY the money
 * fields, so a new or extra backend field never throws. Match the corresponding
 * response types in ./types.ts.
 */

/** Mirrors the money subset of BalanceResponse. */
export const balanceResponseSchema = z
  .object({
    balance: z.number(),
    frozen: z.number(),
    available: z.number(),
  })
  .loose();

/** Mirrors the money subset of OrderResponse (create / single order). */
export const orderResponseSchema = z
  .object({
    quantity: z.number(),
    completed: z.number(),
    price: z.number(),
  })
  .loose();

/** Mirrors the money subset of OrderDetailed (extends OrderResponse). */
export const orderDetailedSchema = z
  .object({
    quantity: z.number(),
    completed: z.number(),
    price: z.number(),
    startCount: z.number().nullable(),
    remains: z.number().nullable(),
  })
  .loose();

/** Stripe deposit checkout: drives the redirect to the hosted pay page. */
export const stripeCheckoutResponseSchema = z
  .object({
    sessionId: z.string(),
    url: z.string(),
  })
  .loose();

/** Cryptomus deposit checkout: drives the redirect to the hosted pay page. */
export const cryptomusCheckoutResponseSchema = z
  .object({
    orderId: z.string(),
    url: z.string(),
  })
  .loose();

/** Landing cart checkout: drives the "Pay $X" redirect to the pay URL. */
export const landingCartCheckoutResultSchema = z
  .object({
    userId: z.string(),
    paymentId: z.string(),
    orderIds: z.array(z.string()),
    checkoutUrl: z.string(),
  })
  .loose();
