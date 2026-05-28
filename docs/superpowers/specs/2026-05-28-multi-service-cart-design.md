# Multi-service calculator (cart) — design

**Status:** Approved (design)
**Date:** 2026-05-28
**Figma:** `tgTn57eng3W1RL78wR8lcx`, node `348:136` (frame "NEW" → "light v1"); order panel = `518:281`, calculator section = `518:166`
**Scope:** Public landing calculator — `frontend/src/components/marketing/service-tiers.tsx` + new cart components/hook, and backend landing guest checkout (`src/modules/landings/`).

## Problem

The landing calculator (`service-tiers.tsx`) lets a guest configure exactly **one** service in the right-hand "order panel" and pay for it via `PaymentMethodModal`. The Figma design replaces this with a **multi-item cart**: the guest adds several services (the same service may be added multiple times), each with its own link and quantity, then pays **once** for the summed total. Email and payment-method selection move inline into the panel — there is no payment modal in this flow.

The backend guest checkout (`executeGuestCheckout`) creates exactly **one** order and **one** payment session for a single tier. Paying once for a multi-item cart requires a new checkout path.

## Design decisions (approved)

- **One payment for the whole cart** (full backend support), matching the macet's single `Pay $X.XX`.
- **Payment is its own entity** (`Payment`), decoupled from the per-service `Order` (which loses `stripeSessionId`, gains `paymentId`). A purchase = one `Payment` + one-or-more `Order`s. This removes the "one order = one payment" conflation; providers depend only on `Payment {id, amount}`.
- **Payment goes through a provider-agnostic abstraction** (`PaymentReference` + `PaymentCompletionRouter`): providers only encode/decode, routing/handlers live in one place. The existing deposit path migrates onto it with no behavior change. (Code abstraction — payment still redirects to the provider's hosted checkout, not embedded.)
- Frontend cart extracted into its own component + hook (not inlined into the already-large `service-tiers.tsx`).
- Same service may appear multiple times in the cart, each item independent.
- Item limit: **20**.
- Per-item validation on **submit** (server authoritative); live total computed **locally** (no `/calculate` per keystroke).
- Cart held **in memory** (does not survive reload); hero link prefills the first added item, as today.
- `checkout-modal.tsx` (tier-card "Buy Now") frontend is **unchanged** (same request/response); its `POST /checkout` endpoint is re-implemented internally on the new `Payment` model (single order) so there is one payment mechanism, not two.
- Theme: build in the existing **dark** landing palette (Figma mock is light; same layout, colors taken from current components).

## Out of scope

- Tier-card "Buy Now" UI (`checkout-modal.tsx`) — frontend unchanged (its endpoint is re-implemented on the new model, same contract).
- Dashboard order creation (authenticated `orders/new`), status-polling worker, admin order views — they keep treating `Order` as the per-service unit and are not modified (they never used `stripeSessionId`).
- Cart persistence across reloads, coupons, saved carts.
- Hero section, other landing sections, SEO/metadata.

## Frontend architecture

Extract the cart out of `service-tiers.tsx` into focused units:

### `frontend/src/lib/landings/use-cart.ts` (hook)
State and operations for the cart.

```ts
interface CartItem {
  id: string;            // local uuid — makes duplicate services independent
  tier: LandingTierResponse;
  link: string;
  quantity: number;
  collapsed: boolean;
}
```
API: `items`, `addItem(tier)`, `removeItem(id)`, `setLink(id, v)`, `setQuantity(id, v)`, `toggleCollapse(id)`, `total` (sum of local `estimatePrice` per item), `count`.
- `addItem` appends an expanded item (quantity defaulted via `defaultQtyForTier`), collapses nothing else (each item independent), enforces the 20-item cap.
- Hero link (sessionStorage / `youboost:hero-link` event) prefills the link of the first item that has an empty link (or the first added item).

### `frontend/src/components/marketing/order-cart.tsx`
The right-hand panel (replaces the single-tier panel + `PaymentMethodModal` in this flow):
- Empty state: "Pick a service to start."
- List of `CartItem` → `cart-item.tsx`.
- `Email` input, `Payment` segmented toggle (`Card` / `Crypto`), `Pay $total` button, fineprint.
- Owns email state, selected provider, submit/validation, and the `checkoutLandingCart` mutation.

### `frontend/src/components/marketing/cart-item.tsx`
One line item:
- Header: icon, service name + description (`truncate`, `min-w-0`), price, delete (🗑), collapse chevron.
- Expanded body: "Add a link" input + "Quantity" input with min/max hint.
- Mobile-safe by construction (`min-w-0` chain, `truncate` link/name) — see the 2026-05-28 mobile-overflow fixes.

### `frontend/src/components/marketing/service-tiers.tsx` (slimmed)
Keeps tabs / search / cards / pagination. Card "Pay" → `cart.addItem(tier)` and scrolls to the panel. Renders `<OrderCart cart={cart} slug={slug} />`.

## Cart behavior

- **Add:** card "Pay" appends the service (expanded, default qty), scrolls panel into view. Duplicates allowed.
- **Edit:** per-item link + quantity; live total updates locally.
- **Collapse/Delete:** independent per item; deleting the last item returns to empty state.
- **Pay enabled when:** cart non-empty AND every item has a non-empty link and quantity within `[minQuantity, maxQuantity]` AND email matches the email regex. Otherwise the offending item/field is highlighted.
- **Submit:** `POST /landing/:slug/checkout/cart` → redirect to `result.checkoutUrl` (validate hostname like the current modal: `*.stripe.com` / `*.cryptomus.com`).
- Server validation errors map back to the relevant item where possible (by index), else a panel-level error.

## Backend — payment model + cart checkout

### Domain model change (the core of this redesign)

`Order` today conflates two concerns: a **purchase/payment** and a **single SMM fulfilment unit**. Payment is glued on via `Order.stripeSessionId` (`@unique`, `prisma/schema.prisma:224`) — set **only** by the guest landing flow (`guest-checkout.flow.ts:82`); balance-funded authenticated orders never touch it (`createOrder` uses `holdFunds`). That coupling is the smell and it blocks "one payment for many services". We fix the model rather than work around it with a grouping column.

Extract funding into its own entity. New **`Payment`** (`prisma/schema.prisma` + `scripts/init-db.sql`):
```prisma
model Payment {
  id                String        @id @default(uuid())
  userId            String        @map("user_id")
  amount            Decimal       @db.Decimal(12, 2)
  provider          String        @db.VarChar(32)      // STRIPE | CRYPTOMUS
  providerSessionId String?       @unique @map("provider_session_id") @db.VarChar(255)
  status            PaymentStatus @default(PENDING)     // PENDING | PAID | FAILED
  createdAt         DateTime      @default(now()) @map("created_at")
  paidAt            DateTime?     @map("paid_at")
  orders            Order[]
  @@index([userId])
}
```
`Order` changes: **drop** `stripeSessionId`; **add** `paymentId String?` (FK → `Payment`, nullable — balance-funded orders leave it null). Everything else on `Order` (status, `externalOrderId`, `remains`, …) stays — it remains the fulfilment unit, untouched by the status worker / admin / dashboard / balance flow.

Result: provider integrations depend only on a **`Payment`** (`{ id, amount }`). A purchase = one `Payment` with **one or more** `Order`s. Single guest order = `Payment` with 1 order; cart = `Payment` with N. `checkoutGroupId` is not needed. Migration drops `Order.stripe_session_id`, adds `Order.payment_id` + the `Payment` table + `PaymentStatus` enum (dev DB; no prod backfill).

### Endpoints
- New **`POST /landing/:slug/checkout/cart`** — multi-item.
- Existing **`POST /landing/:slug/checkout`** stays (used by `checkout-modal.tsx`) but is **re-implemented on the new model** as a `Payment` with a single order (N=1). Same request/response shape — no change for that caller. This keeps exactly **one** payment-linking mechanism.

Cart request/response:
```ts
// body
{ email: string;
  items: Array<{ tierId: string; link: string; quantity: number }>;  // 1..20
  paymentProvider?: 'stripe' | 'cryptomus'; }
// result
{ userId: string; paymentId: string; orderIds: string[]; checkoutUrl: string; }
```
Zod `landingCartCheckoutSchema` in `landing.types.ts` (email; `items` 1..20; each tierId/link/quantity validated).

### Flow — `executeGuestCartCheckout` (`guest-cart-checkout.flow.ts`)
1. Load landing (must be `PUBLISHED`).
2. Per item: resolve tier in landing (`LANDING_TIER_MISMATCH`), look up service, validate `quantity ∈ [min,max]` (`QUANTITY_BELOW_MIN`/`ABOVE_MAX`, with item index), price = `round(pricePer1000 * qty / 1000, 2)`.
3. `total = Σ item price`.
4. `autoUserCreator.createAutoUser(email)` → guest user.
5. Create a `PENDING` **`Payment`** (`amount=total`, provider) + N `PENDING_PAYMENT` `Order`s linked via `paymentId` (single transaction).
6. Create the provider session for the `Payment` via the abstraction below (reference `{ kind:'order-payment', paymentId, userId }`, `amount=total`, `productName = \`${items.length} services\``); store the returned `providerSessionId` on the `Payment`.
7. Emit `landing.guest_checkout_started` outbox (landingId, paymentId, orderIds, userId, email, provider).
8. Return `{ userId, paymentId, orderIds, checkoutUrl }`.

`executeGuestCheckout` (single) becomes this flow with one item.

### Payment abstraction (the "interface")

Providers must not own *what a payment is for* or *which handler settles it*. Introduce a provider-agnostic reference + one router.

**`PaymentReference`** (`src/modules/billing/payment-reference.ts`):
```ts
type PaymentReference =
  | { kind: 'deposit';       depositId: string; userId: string }
  | { kind: 'order-payment'; paymentId: string; userId: string };
```
Each provider implements:
- `encodeReference(ref)` → provider payload. **Stripe**: `metadata`. **Cryptomus**: `order_id` string (`dep-<id>` / `pay-<id>`).
- `decodeReference(completedSession)` → `PaymentReference | null`.

**`PaymentCompletionRouter`** (`payment-completion.router.ts`) maps kind → handler:
- `deposit` → `confirmDepositTransaction` (behavior unchanged)
- `order-payment` → `confirmOrderPayment(paymentId)`

Both providers' webhooks collapse to `router.handle(this.decodeReference(session))`; session creation collapses to one `createPaymentSession({ amount, productName, reference, successUrl, cancelUrl })`. The **deposit path migrates onto this with no behavior change** (existing tests stay green); `order-payment` (single & cart) is the new path. Adding a future payment kind = one union variant + one router case.

### Settlement — `confirmOrderPayment(paymentId)`
- Load `Payment` + its `Order`s. **Idempotent:** if `Payment` already `PAID`, return.
- Mark `Payment = PAID` (`paidAt`); for **each** child `Order` still `PENDING_PAYMENT`: submit to its SMM provider, `→ PROCESSING`, emit `order.created`.
- Extract `submitGuestOrder(order)` from `confirm-guest-order.flow.ts`, reused for N=1 and N>1; safe to re-run after a partial failure (already-`PROCESSING` orders are skipped).

### Ports
- `GuestOrderCreatorPort` → `createPaymentWithOrders({ userId, provider, amount, items })` → `{ paymentId, orderIds }` (replaces single `createPendingPaymentOrder`; single-item path passes one item).
- New `PaymentSessionPort.createPaymentSession({ provider, amount, productName, reference, successUrl, cancelUrl })` → `{ sessionId, url }`; flow stores `sessionId` on the `Payment`.
- `OrderPaymentProcessorPort.confirmOrderPayment(paymentId)` (replaces `GuestOrderProcessorPort.confirmGuestOrderPayment`). `PaymentCompletionRouter` dispatches deposit/order-payment. Wired in composition root (`src/composition/landings-adapters.ts`, billing composition).

## API/types summary

- Frontend `lib/api/landings.ts`: `checkoutLandingCart(slug, body)` (existing `checkoutLanding` unchanged).
- Frontend `lib/api/types.ts`: `LandingCartCheckoutBody`, `LandingCartCheckoutResult`.
- Backend `landing.types.ts`: `landingCartCheckoutSchema`, `LandingCartCheckoutInput`, `LandingCartCheckoutResult`.
- Backend cart route in `landing.routes.ts`; service `service.checkoutCart`; presenter mapping.

## Testing

**Backend (TDD, target ≥80%):**
- `executeGuestCartCheckout`: `total = Σ` item prices; one `Payment(amount=total)` + N `Order`s linked via `paymentId`; provider session created once with reference `order-payment`; `providerSessionId` stored on the `Payment`.
- per-item validation (tier mismatch, qty below/above) returns error with item index; empty `items` and >20 rejected by schema.
- single `executeGuestCheckout` still works as `Payment` with 1 order (regression).
- `confirmOrderPayment`: marks `Payment` PAID and settles **all** child orders (each submitted, → `PROCESSING`); idempotent (re-run on a PAID payment is a no-op; partial-failure re-run completes the rest).
- **payment abstraction:** per provider, `encodeReference`/`decodeReference` round-trips both kinds (deposit, order-payment); unknown/garbage session → `null`. `PaymentCompletionRouter` dispatches each kind to the right handler. Regression: existing **deposit** completion behavior unchanged through the new router (current deposit tests stay green).

**Frontend E2E (Playwright):**
- Add 2+ services (incl. a duplicate) → cart shows N items; total = sum.
- Edit qty/link → total updates; delete/collapse work; empty state returns.
- Per-item validation blocks Pay; valid cart + email → mocked `checkout/cart` → redirect asserted with summed amount in payload.
- **Mobile** (`/mobile/` project): no horizontal overflow with multiple long links across items; Pay button within viewport.

## Implementation notes — parallelizable workstreams

Implementation may be run **multi-agent** (per user). Independent streams:

- **Stream 0 — payment model + abstraction (prerequisite):** `Payment` table + `PaymentStatus` enum migration, `Order` drop `stripeSessionId` / add `paymentId`; `PaymentReference`, per-provider `encodeReference`/`decodeReference`, `PaymentCompletionRouter`, `createPaymentSession`; migrate the existing deposit + single guest-order paths onto it with **no behavior change** (existing tests green). Lands first — everything else builds on it.
- **Stream 1a — cart checkout:** `executeGuestCartCheckout`, `createPaymentWithOrders` port, cart route + zod schema + presenter, composition wiring, unit tests.
- **Stream 1b — settlement:** `confirmOrderPayment` + `confirm-guest-order` refactor (`submitGuestOrder` core), `order-payment` router case, unit tests.
- **Stream 2 — frontend cart:** `use-cart` hook, `order-cart`, `cart-item`, slim `service-tiers`, API client/types.
- **Stream 3 — E2E:** desktop cart spec + mobile overflow spec (depends on 2; mocks backend).

Order/parallelism: Stream 0 first (it reshapes the schema + ports — the foundation). Then 1a‖1b‖2 in parallel once the API contract (§"API/types") and the `Payment`/ports are frozen. Stream 3 follows 2.
