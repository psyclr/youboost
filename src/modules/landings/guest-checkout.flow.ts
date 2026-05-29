import type { LandingCheckoutInput, LandingCheckoutResult } from './landing.types';
import type { GuestCartCheckoutFlowDeps } from './guest-cart-checkout.flow';
import { executeGuestCartCheckout } from './guest-cart-checkout.flow';

export type { GuestCartCheckoutFlowDeps as GuestCheckoutFlowDeps };

/**
 * Single-item guest checkout — delegates to `executeGuestCartCheckout` with a
 * 1-element items array, then adapts the cart result to the legacy
 * `LandingCheckoutResult` shape (`orderId`, `userId`, `checkoutUrl`) that
 * `checkout-modal.tsx` and the `/checkout` route consume.
 */
export async function executeGuestCheckout(
  deps: GuestCartCheckoutFlowDeps,
  slug: string,
  input: LandingCheckoutInput,
): Promise<LandingCheckoutResult> {
  const r = await executeGuestCartCheckout(deps, slug, {
    email: input.email,
    items: [{ tierId: input.tierId, link: input.link, quantity: input.quantity }],
    paymentProvider: input.paymentProvider,
  });
  const orderId = r.orderIds[0];
  if (!orderId) throw new Error('cart checkout returned no order IDs');
  return { orderId, userId: r.userId, checkoutUrl: r.checkoutUrl };
}
