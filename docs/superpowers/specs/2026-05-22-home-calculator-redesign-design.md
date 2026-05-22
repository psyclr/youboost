# Home calculator redesign — design

**Status:** Draft
**Date:** 2026-05-22
**Scope:** `frontend/src/components/marketing/hero.tsx` (Instant Calculator only)

## Problem

The home page hero shows a calculator card with seven controls visible at once: service select, link input, quantity, email, Card/Crypto toggle, `Calculate` button, and `Pay $X` button. The same set of fields is duplicated inside `CheckoutModal` (opened from `Buy Now` on tier cards). The result is a noisy first impression and a redundant `Calculate`/`Pay` two-button pattern.

User goal: reduce visible buttons on the home page and walk the guest through a clear three-stage flow — paste link → see settings with live price → pick payment method.

## Out of scope

- Tier cards section (`Services & Prices` with `Buy Now`) and `CheckoutModal` — stay as-is.
- All other landing sections: `FeatureRow`, `Steps`, `FaqAccordion`, `Footer`, `SiteHeader`.
- Backend, API, types, landing schema.
- SEO/metadata in `frontend/src/app/page.tsx`.
- `HomeAuthRedirect` behavior.

## User flow

Three stages, all on the same page, no navigation:

1. **Step 1 (`link-only`)** — Hero calculator card shows only a link input and a `Go →` button. Microcopy below: `landing.hero.fineprint` (e.g. "No registration needed").
2. **Step 2 (`details`)** — Same card morphs to show: link (editable), service select, quantity input with min/max hint, live price `$X.XX` in the card header, and a single `Pay $X.XX` button.
3. **Step 3 (modal)** — Pressing `Pay` opens a `Dialog` with an order summary (service · qty · link · price), email input, and two buttons: `Pay with Card` (→ Stripe) and `Pay with Crypto` (→ Cryptomus). Picking a method redirects to the provider checkout URL.

```
┌─ STEP 1: link-only ────────────────┐    ┌─ STEP 2: details ──────────────────┐
│ INSTANT CALCULATOR                 │    │ INSTANT CALCULATOR    $12.50       │
│                                    │    │                                    │
│ Paste your YouTube link            │    │ Link  [https://youtube.com/...]    │
│ [ https://...               ]      │    │ Service  [▼ Mega Fast Views     ]  │
│                                    │    │ Quantity [ 5000        ]           │
│ [        Go  →        ]            │    │ Min 1,000 · Max 1,000,000          │
│                                    │    │                                    │
│ No registration needed             │    │ [        Pay $12.50          ]     │
└────────────────────────────────────┘    └────────────────────────────────────┘
                                                         │
                                                         ▼ on click
                          ┌─ DIALOG: choose payment ─────────────────┐
                          │ Pay $12.50                               │
                          │ Mega Fast Views · 5,000                  │
                          │ youtube.com/watch?...                    │
                          │                                          │
                          │ Email  [you@example.com         ]        │
                          │                                          │
                          │ [   Pay with Card (Stripe)        ]      │
                          │ [   Pay with Crypto (Cryptomus)   ]      │
                          │                                          │
                          │ You'll get a confirmation by email       │
                          └──────────────────────────────────────────┘
```

## Components

| Component | File | Responsibility |
|---|---|---|
| `Hero` | `frontend/src/components/marketing/hero.tsx` (rewritten) | Pure layout: eyebrow, title, lead, stats, slot for `<HeroCalculator>`. Props unchanged: `{slug, hero, stats, tiers}`. |
| `HeroCalculator` | `frontend/src/components/marketing/hero-calculator.tsx` (new) | State machine of the calculator card. Holds `step`, `link`, `tierId`, `quantity`, `calcResult`, `formError`, `payOpen`. Renders `LinkStep` or `DetailsStep` based on `step`. Owns the call to `/landing/{slug}/calculate` on `Pay` click. |
| `LinkStep` | inline inside `hero-calculator.tsx` | Link input + `Go` button. Local error display. |
| `DetailsStep` | inline inside `hero-calculator.tsx` | Link (editable) + service select + quantity + min/max hint + `Pay $X` button. Live price computed locally. |
| `PaymentMethodModal` | `frontend/src/components/marketing/payment-method-modal.tsx` (new) | `Dialog` with summary, email input, two method buttons. Owns its own `email`, `methodPending`, `modalError`. Calls `checkoutLanding(...)` and `window.location.href = result.checkoutUrl`. |

### Deleted

- The internal `GuestCalculator` inside `hero.tsx` (replaced by `HeroCalculator` + `PaymentMethodModal`).

### Shared utilities

`pickDefaultTier`, `defaultQtyForTier`, `estimatePrice`, `formatUsd` are currently duplicated between `hero.tsx` and `checkout-modal.tsx`. Extract them to `frontend/src/lib/landings/calculator.ts` and import from both places. `CheckoutModal` is not otherwise modified — only its import lines change to point at the shared module.

## State and behavior

### `HeroCalculator` state

```ts
type Step = 'link' | 'details';
const [step, setStep] = useState<Step>('link');
const [link, setLink] = useState('');
const [tierId, setTierId] = useState(initialTier.id);
const [quantity, setQuantity] = useState(defaultQtyForTier(initialTier, hero.minAmount));
const [calcResult, setCalcResult] = useState<LandingCalculateResult | null>(null);
const [formError, setFormError] = useState<string | null>(null);
const [payOpen, setPayOpen] = useState(false);
```

`calcResult` is reset to `null` whenever `tierId`, `quantity`, or `link` changes — stale canonical prices must not leak into the modal.

### Transitions

| From | Trigger | Condition | Effect |
|---|---|---|---|
| `link` | click `Go` | `link.trim() === ''` | `formError = 'Paste a link to your video or channel.'` |
| `link` | click `Go` | otherwise | `step = 'details'`, `formError = null` |
| `details` | edit link/qty/tier | always | `calcResult = null` (live local price still shown) |
| `details` | click `Pay` | local validation fails | `formError = <reason>`; modal does not open |
| `details` | click `Pay` | local OK; `/calculate` returns invalid | `formError = result.reason ?? 'Invalid quantity or link.'`; modal does not open |
| `details` | click `Pay` | local OK; `/calculate` valid | `calcResult = result`; `payOpen = true` |
| modal | `onOpenChange(false)` | — | `payOpen = false`; modal-internal state (`email`, `modalError`, `methodPending`) is reset via `key` remount |

No back transition `details → link` — the link field stays editable inside step 2.

### Price calculation

Two layers:

- **Live display (instant, local):** `estimatePrice(selectedTier, quantity)` — pure function, runs on every render. Shown in the card header and on the `Pay $X.XX` button label.
- **Canonical (on submit, backend):** `calculateLanding({serviceId, quantity, link})` is called once when the user clicks `Pay`. If valid, the canonical `result.price` is what the modal displays and what `checkoutLanding` will charge — guaranteeing the user sees the exact price they will pay.

No debounced backend calls while typing.

### Validation matrix

| Stage | Check | Where shown |
|---|---|---|
| Step 1 click `Go` | `link.trim() !== ''` | `formError` under link input |
| Step 2 click `Pay` (local) | `quantity` finite & `min ≤ quantity ≤ max`; `link.trim() !== ''` | `formError` above Pay button |
| Step 2 click `Pay` (backend) | `result.valid === true` | `formError` above Pay button; modal blocked |
| Modal click `Pay with X` | `email` matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `modalError` above method buttons |
| Modal `/checkout` failure | network/provider error | `modalError`; `methodPending = null` |

Error messages from the backend are routed through `publicApiErrorMessage(err, fallback)` (existing util in `@/lib/api/error-messages`).

### Button states

| Button | Disabled when | Label |
|---|---|---|
| `Go →` (step 1) | `link.trim() === ''` | `landing.hero.ctaLabel ?? 'Go →'` |
| `Pay $X.XX` (step 2) | qty out of range OR `calcMutation.isPending` | `Calculating…` while pending, else `Pay $X.XX` |
| `Pay with Card` (modal) | `methodPending !== null` | `Redirecting…` if `methodPending === 'stripe'`, else `Pay with Card` |
| `Pay with Crypto` (modal) | `methodPending !== null` | `Redirecting…` if `methodPending === 'cryptomus'`, else `Pay with Crypto` |

### Landing field reuse

- `landing.hero.placeholder` — placeholder of the link input.
- `landing.hero.ctaLabel` — label of the `Go` button if provided; fallback `Go →`.
- `landing.hero.fineprint` — microcopy under the input in step 1.
- `landing.hero.minAmount` — feeds `defaultQtyForTier` (unchanged).
- `landing.hero.defaultServiceId` — preselected tier via `pickDefaultTier` (unchanged).

## API usage

No new endpoints. Reuses:

- `POST /landing/{slug}/calculate` — called on `Pay` click for canonical price/validation.
- `POST /landing/{slug}/checkout` — called from the modal when a method is chosen; payload includes `paymentProvider: 'stripe' | 'cryptomus'`. Response `{ checkoutUrl }` → `window.location.href`.

## Non-goals (explicit)

- No debounced or on-keystroke backend calls.
- No localStorage persistence of form state.
- No analytics/telemetry events.
- No back button from step 2 to step 1.
- No changes to `CheckoutModal`, tier cards, or the rest of the landing.

## Testing

### Playwright E2E (new): `frontend/e2e/home-calculator.spec.ts`

Uses `test.describe.serial`, no login required. Mocks `/landing/.../calculate` and `/landing/.../checkout` via `page.route()` to avoid hitting Stripe/Cryptomus.

| # | Scenario | Assertion |
|---|---|---|
| 1 | Step 1 visible on load | Only link input and `Go` are visible; service select, quantity, email, payment toggle, `Calculate` are not in DOM. |
| 2 | Empty link → Go | Inline error visible; step 2 elements still not rendered. |
| 3 | Valid link → Go → step 2 | Service select, quantity, `Pay $X.XX` rendered. Link input still editable. |
| 4 | Live price | Change quantity → card header price and `Pay $X.XX` label update without any click. |
| 5 | Tier change | Change service → quantity updated to new default; price updates. |
| 6 | Pay → modal opens | `/calculate` mocked to `{valid:true, price:12.5}`. Click `Pay` → dialog with summary visible; email empty. |
| 7 | Modal invalid email | Click `Pay with Card` with empty email → inline error; `/checkout` not called. |
| 8 | Modal Card → Stripe | Mock `/checkout` `{checkoutUrl:'https://stripe.test/x'}`. Click `Pay with Card` → request body has `paymentProvider:'stripe'`; navigation to mocked URL asserted. |
| 9 | Modal Crypto → Cryptomus | Same as #8 with `paymentProvider:'cryptomus'`. |
| 10 | `/calculate` invalid | Mock `{valid:false, reason:'Quantity too high'}`. Click `Pay` → modal does not open; reason visible in card. |
| 11 | Modal close preserves step 2 | Close modal → step 2 state (qty, tier, link) intact; reopen → email field is empty again. |

### Manual smoke (`verify` skill)

1. Local: `npm run start:dev` (backend) + `cd frontend && npx next dev -p 3001`.
2. Walk Step 1 → Step 2 → Pay → Stripe test card → confirm redirect back.
3. Repeat with Cryptomus.
4. Mobile viewport (375×812) — card adapts, modal readable.
5. Verify tier cards `Buy Now` → `CheckoutModal` flow still works.
6. Verify `HomeAuthRedirect` still redirects a logged-in user away from `/`.

### Static checks

- ESLint (post-edit hook).
- `tsc --noEmit` (pre-commit).
- Backend Jest coverage untouched (no backend changes).
