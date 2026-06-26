# Order Fulfilment: Multi-Panel Auto-Failover & Customer-Shielded Status

**Date:** 2026-06-24
**Status:** Approved (design), implementation in two phases

## Problem / Context

Prod was switched to real provider mode (`PROVIDER_MODE=real`). Real panels fail
(no balance, unknown service, panel down). Today each service is pinned to **one**
panel (`service.providerId` + `externalServiceId`); on failure the guest order was
refunded to the wallet + a "we couldn't start your order" email was sent. Product
decision: **the customer must never see the failure machinery** — they only ever
see an order "In progress" (with progress) → "Completed". Failures, panel
juggling, and recovery are an operations concern (admin), not a customer concern.

## Product model (agreed)

- **Customer sees only** "In progress" (+ progress) and "Completed". Internal
  states (awaiting payment, partial, failed, panel switching) are never shown.
- On a panel failure we **silently route the order to another panel** — the
  customer notices nothing.
- **Customer price never changes**, even if the fallback panel costs us more — we
  absorb the margin difference.
- **Admin** sees real statuses and is **notified** on failure / failover.
- **We track every provider attempt** (panel, outcome, error, our cost) for
  reliability + margin analytics.
- **Refund is the last resort** — only when *no* panel can fulfil. Decided by the
  admin, framed positively ("returned to your balance"); never an alarming
  "failed" message.

## Phase 1 — Customer-shielded status (fast, safe, ship first)

Pure presentation. No money/flow change.

- Customer-facing order views (`/orders` list, `/orders/[id]` detail) collapse the
  raw status to a customer status:
  - `COMPLETED` → **Completed**
  - `CANCELLED` → **Cancelled** (only reachable by the customer's own cancel)
  - `REFUNDED` → **Refunded** (positive — money is back)
  - everything else (`PENDING`, `PENDING_PAYMENT`, `PROCESSING`, `PARTIAL`,
    `FAILED`) → **In progress**
- **Admin views keep the raw status** (`StatusBadge` stays raw; the mapping is
  applied only in the customer pages, not inside the shared badge).
- `PENDING_PAYMENT` (currently absent from the frontend `OrderStatus` type and the
  badge map → renders blank) is covered by the collapse, so no blank badges.
- Cancel/refill buttons keep gating on the real status returned by the API; a rare
  edge (a FAILED order shown as "In progress" whose cancel call is rejected) is
  acceptable for Phase 1 and resolved by Phase 2 (FAILED becomes transient).

**Files:** `frontend/src/lib/orders/customer-status.ts` (new — map fn),
`frontend/src/app/(dashboard)/orders/page.tsx`,
`frontend/src/app/(dashboard)/orders/[id]/page.tsx`. Unit test for the map.

## Phase 2 — Auto-failover engine

### Data model
- **`service_provider_mappings`** (new): `id, serviceId, providerId,
  externalServiceId, priority, providerCost, isActive`. N rows per service = the
  ordered list of panels that can fulfil it. The customer price stays on the
  service/landing tier (unchanged); `providerCost` is our cost on that panel, for
  tracking only. `service.providerId`/`externalServiceId` stay as the legacy/
  primary (migration seeds one mapping row from them).
- **`provider_order_attempts`** (new): `id, orderId, providerId, externalServiceId,
  outcome (SUCCESS|FAILED), error, providerCost, createdAt` — one row per attempt,
  for analytics + admin.

### Submission with failover
- Replace the single `selectProviderById(service.providerId)` in
  `submitGuestOrder` and `executeCreateOrder` with an ordered walk over the
  service's active mappings (by priority):
  - try submit → on success: order PROCESSING, record SUCCESS attempt, stop.
  - on failure: record FAILED attempt, **notify admin** (panel X failed for order
    Y), try next mapping.
  - all mappings exhausted: order internal **FAILED**, **alert admin** (needs
    action). Customer still sees "In progress" until admin resolves.
- Keep the per-order claim for exactly-once. Circuit breaker (already present) can
  short-circuit a known-down panel.

### Admin notification + tracking
- New outbox event `order.provider_failed` (orderId, providerId, error) →
  admin notification handler (in-app/email to admin) on each panel failure.
- New `order.fulfilment_exhausted` (orderId) when all panels fail → admin alert.
- `provider_order_attempts` rows power an admin view + our metrics (panel success
  rate, failover frequency, cost).

### Revert of the interim behaviour
- Remove the auto-refund-to-wallet + customer "order failed" email added on
  2026-06-24 (commits b0eaee8 / 21b9995). Replaced by failover + admin-driven
  resolution. Refund becomes an admin action (positive framing) for the
  exhausted case.

### Pricing
- Customer price is fixed (the tier/service price they paid). The chosen panel's
  `providerCost` never affects what the customer is charged; it's recorded for our
  margin analytics only.

## Error handling
- Provider failure during failover is expected control flow, not an exception that
  reaches the webhook — webhook stays 200, order ends PROCESSING (some panel) or
  internal FAILED (admin alerted). No retry storms.
- Exactly-once via the existing per-order claim; attempts are append-only.

## Testing
- Phase 1: unit test for the status-collapse map; existing orders e2e still green.
- Phase 2: unit tests for the failover walk (first panel fails → second succeeds;
  all fail → FAILED + exhausted event); attempt records written; admin
  notification emitted; integration test on the real test DB for the full
  settlement→failover path; "teeth" check (break a panel, assert failover).

## Open items
- Admin notification channel (in-app vs email-to-admin) — default: outbox →
  notification to admin users; refine in the plan.
- Auto-failover ordering: by `priority` then by lowest `providerCost`? Default:
  `priority` asc; cost as tiebreaker. Confirm in the plan.
