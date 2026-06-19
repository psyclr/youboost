/**
 * Single place for analytics events. Today it talks to Yandex.Metrika; keeping
 * every event behind this helper means new events are a one-line add and the
 * call sites don't know about the provider.
 *
 * Safe to call anywhere: no-ops on the server and when Metrika isn't loaded
 * (dev/e2e — the counter only loads in production), so call sites never guard.
 *
 * Note: "purchase" is intentionally NOT here — a purchase is a *confirmed*
 * payment, which is known on the server (the payment webhook), not in the
 * browser. It is reported server-side. The browser only records intent
 * (checkoutStarted) and cart activity.
 */
const COUNTER_ID = 109942271;

declare global {
  interface Window {
    ym?: (counterId: number, action: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Push an ecommerce object to the dataLayer Metrika reads (ecommerce: "dataLayer"). */
function pushEcommerce(ecommerce: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ ecommerce });
}

/** Fire a Metrika goal (configured in the Metrika dashboard). */
function reachGoal(goal: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.ym) return;
  window.ym(COUNTER_ID, 'reachGoal', goal, params);
}

export interface AnalyticsProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export const analytics = {
  /** A service was added to the cart. */
  addToCart(product: AnalyticsProduct): void {
    pushEcommerce({ currencyCode: 'USD', add: { products: [product] } });
  },

  /** The customer pressed "Pay" — intent to buy, not yet a purchase. */
  checkoutStarted(params: { total: number; itemCount: number }): void {
    reachGoal('checkout_started', params);
  },
};
