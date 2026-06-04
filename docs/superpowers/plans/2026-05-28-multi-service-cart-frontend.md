# Multi-service cart — Frontend + E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-service landing order panel with a multi-item cart (add many services, each with its own link + quantity, pay once for the summed total) per the Figma design, with email + payment method inline (no modal).

**Architecture:** A `useCart` hook owns the cart array; `OrderCart` renders the panel (items + email + Card/Crypto + `Pay $total`); `CartItem` renders one collapsible line. `ServiceTiers` slims to the catalog and pushes services into the cart. Calls the new `POST /landing/:slug/checkout/cart`.

**Tech Stack:** Next.js (App Router), React, TanStack Query, Tailwind, Jest + Testing Library (unit), Playwright (E2E). Spec: `docs/superpowers/specs/2026-05-28-multi-service-cart-design.md`.

**Depends on:** Backend plan's API contract (`checkoutLandingCart` body/result). Backend need not be deployed — E2E mocks it.

**Commands:** unit `cd frontend && npx jest <path>` · typecheck `cd frontend && npx tsc --noEmit` · e2e `cd frontend && npx playwright test <file>` (stop Docker frontend, run local dev on 3001 with Node 22 at `/opt/nodejs` first — see CLAUDE.md).

---

## File structure

**Create:**

- `frontend/src/lib/landings/use-cart.ts` — cart state hook.
- `frontend/src/lib/landings/__tests__/use-cart.test.ts`
- `frontend/src/components/marketing/order-cart.tsx` — the panel.
- `frontend/src/components/marketing/cart-item.tsx` — one line item.
- `frontend/e2e/landing-cart.spec.ts` — desktop cart E2E.
- `frontend/e2e/mobile-cart.spec.ts` — mobile overflow with multiple long links.

**Modify:**

- `frontend/src/lib/api/landings.ts` — add `checkoutLandingCart`.
- `frontend/src/lib/api/types.ts` — add `LandingCartCheckoutBody`, `LandingCartCheckoutResult`.
- `frontend/src/components/marketing/service-tiers.tsx` — slim to catalog; card `Pay` → `cart.addItem(tier)`; render `<OrderCart>`; drop single-tier panel + `PaymentMethodModal`.

**Leave unchanged:** `payment-method-modal.tsx` and `checkout-modal.tsx` (the latter is the tier-card "Buy Now" flow, still single-item). `payment-method-modal.tsx` becomes unused by `service-tiers` but is not deleted (out of scope).

---

### Task 1: API client + types

**Files:**

- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/landings.ts`

- [ ] **Step 1: Add types** to `types.ts` (next to `LandingCheckoutBody`):

```ts
export interface LandingCartCheckoutItem {
  tierId: string;
  link: string;
  quantity: number;
}
export interface LandingCartCheckoutBody {
  email: string;
  items: LandingCartCheckoutItem[];
  paymentProvider?: 'stripe' | 'cryptomus';
}
export interface LandingCartCheckoutResult {
  userId: string;
  paymentId: string;
  orderIds: string[];
  checkoutUrl: string;
}
```

- [ ] **Step 2: Add the client fn** to `landings.ts`:

```ts
export const checkoutLandingCart = (slug: string, body: LandingCartCheckoutBody) =>
  apiRequest<LandingCartCheckoutResult>(`/landing/${encodeURIComponent(slug)}/checkout/cart`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
```

(Import the two new types alongside the existing landing imports.)

- [ ] **Step 3: Typecheck** — `cd frontend && npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api/types.ts frontend/src/lib/api/landings.ts
git commit -m "feat(frontend): landing cart checkout API client + types"
```

---

### Task 2: `useCart` hook

**Files:**

- Create: `frontend/src/lib/landings/use-cart.ts`
- Create: `frontend/src/lib/landings/__tests__/use-cart.test.ts`

Uses existing helpers from `frontend/src/lib/landings/calculator.ts`: `estimatePrice(tier, qty)`, `defaultQtyForTier(tier, defaultMinAmount)`.

- [ ] **Step 1: Write the failing test** (Testing Library `renderHook`):

```ts
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../use-cart';
import type { LandingTierResponse } from '@/lib/api/types';

const tier = (id: string, price: number, min = 50, max = 100000): LandingTierResponse =>
  ({
    id,
    serviceId: `svc-${id}`,
    priceOverride: null,
    titleOverride: null,
    descOverride: null,
    unit: '1000',
    service: {
      id: `svc-${id}`,
      name: `S${id}`,
      description: '',
      platform: 'YOUTUBE',
      type: 'VIEWS',
      pricePer1000: price,
      minQuantity: min,
      maxQuantity: max,
    } as never,
  }) as never;

it('adds an item (expanded) and computes total from local estimate', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1))); // $1/1000
  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0].collapsed).toBe(false);
  expect(result.current.total).toBeGreaterThan(0);
});

it('allows the same service twice as independent items', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => {
    result.current.addItem(tier('1', 1));
    result.current.addItem(tier('1', 1));
  });
  expect(result.current.items).toHaveLength(2);
  expect(result.current.items[0].id).not.toBe(result.current.items[1].id);
});

it('total is the sum of per-item estimates', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => {
    result.current.addItem(tier('1', 2));
    result.current.addItem(tier('2', 3));
  });
  act(() => {
    result.current.setQuantity(result.current.items[0].id, 1000);
    result.current.setQuantity(result.current.items[1].id, 1000);
  });
  expect(result.current.total).toBeCloseTo(5, 2);
});

it('removes an item; empty cart has total 0 and count 0', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1)));
  const id = result.current.items[0].id;
  act(() => result.current.removeItem(id));
  expect(result.current.items).toHaveLength(0);
  expect(result.current.total).toBe(0);
  expect(result.current.count).toBe(0);
});

it('enforces the 20-item cap', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => {
    for (let i = 0; i < 25; i++) result.current.addItem(tier(String(i), 1));
  });
  expect(result.current.items).toHaveLength(20);
});

it('setLink / toggleCollapse update the right item', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1)));
  const id = result.current.items[0].id;
  act(() => {
    result.current.setLink(id, 'https://x/1');
    result.current.toggleCollapse(id);
  });
  expect(result.current.items[0].link).toBe('https://x/1');
  expect(result.current.items[0].collapsed).toBe(true);
});
```

- [ ] **Step 2: Run it, verify it fails** — `cd frontend && npx jest src/lib/landings/__tests__/use-cart.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `frontend/src/lib/landings/use-cart.ts`**

```ts
import { useMemo, useState, useCallback } from 'react';
import type { LandingTierResponse } from '@/lib/api/types';
import { estimatePrice, defaultQtyForTier } from './calculator';

const MAX_ITEMS = 20;

export interface CartItem {
  id: string;
  tier: LandingTierResponse;
  link: string;
  quantity: number;
  collapsed: boolean;
}

export interface UseCart {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (tier: LandingTierResponse) => void;
  removeItem: (id: string) => void;
  setLink: (id: string, link: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  toggleCollapse: (id: string) => void;
}

export function useCart({ defaultMinAmount }: { defaultMinAmount: number }): UseCart {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (tier: LandingTierResponse) => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${prev.length}`;
        return [
          ...prev,
          {
            id,
            tier,
            link: '',
            quantity: defaultQtyForTier(tier, defaultMinAmount),
            collapsed: false,
          },
        ];
      });
    },
    [defaultMinAmount],
  );

  const removeItem = useCallback((id: string) => setItems((p) => p.filter((i) => i.id !== id)), []);
  const setLink = useCallback(
    (id: string, link: string) => setItems((p) => p.map((i) => (i.id === id ? { ...i, link } : i))),
    [],
  );
  const setQuantity = useCallback(
    (id: string, quantity: number) =>
      setItems((p) => p.map((i) => (i.id === id ? { ...i, quantity } : i))),
    [],
  );
  const toggleCollapse = useCallback(
    (id: string) =>
      setItems((p) => p.map((i) => (i.id === id ? { ...i, collapsed: !i.collapsed } : i))),
    [],
  );

  const total = useMemo(
    () => Math.round(items.reduce((s, i) => s + estimatePrice(i.tier, i.quantity), 0) * 100) / 100,
    [items],
  );

  return {
    items,
    count: items.length,
    total,
    addItem,
    removeItem,
    setLink,
    setQuantity,
    toggleCollapse,
  };
}
```

- [ ] **Step 4: Run it, verify it passes** — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/landings/use-cart.ts frontend/src/lib/landings/__tests__/use-cart.test.ts
git commit -m "feat(frontend): useCart hook (multi-item cart state + live total)"
```

---

### Task 3: `CartItem` component

**Files:**

- Create: `frontend/src/components/marketing/cart-item.tsx`

Mirror the current order-panel item markup in `service-tiers.tsx` (header with name/desc `truncate min-w-0`, price, Trash2, Chevron; expanded body with "Add a link" + "Quantity"). Apply the mobile-overflow lessons: `min-w-0` chain, `truncate` on name/desc. Use `formatUsd` from `calculator.ts`, `estimatePrice` for the per-item price, icons from `lucide-react` (`Trash2`, `ChevronUp`, `ChevronDown`).

- [ ] **Step 1: Implement `cart-item.tsx`** (props-driven, no local state):

```tsx
'use client';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { formatUsd, estimatePrice } from '@/lib/landings/calculator';
import type { CartItem as CartItemType } from '@/lib/landings/use-cart';

interface CartItemProps {
  item: CartItemType;
  onRemove: () => void;
  onToggle: () => void;
  onLink: (v: string) => void;
  onQuantity: (v: number) => void;
}

export function CartItem({ item, onRemove, onToggle, onLink, onQuantity }: CartItemProps) {
  const { tier } = item;
  const name = tier.titleOverride ?? tier.service.name;
  const price = estimatePrice(tier, item.quantity);
  return (
    <div className="overflow-hidden rounded-[3px] border" style={{ borderColor: '#363636' }}>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-semibold text-white">{name}</h4>
          {tier.service.description ? (
            <p className="truncate text-[12px] text-[#a2a2a2]">{tier.service.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[18px] font-bold text-white">{formatUsd(price)}</span>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-label="Remove item"
              onClick={onRemove}
              className="rounded-[3px] border p-1.5 text-[#676767]"
              style={{ borderColor: '#363636' }}
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={item.collapsed ? 'Expand item' : 'Collapse item'}
              onClick={onToggle}
              className="rounded-[3px] border p-1.5 text-[#676767]"
              style={{ borderColor: '#363636' }}
            >
              {item.collapsed ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      {item.collapsed ? null : (
        <div className="flex flex-col gap-3 border-t px-3 py-3" style={{ borderColor: '#363636' }}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-white">Add a link</span>
            <input
              type="text"
              value={item.link}
              onChange={(e) => onLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Add a link"
              className="w-full min-w-0 rounded-[3px] border px-3 py-2.5 text-[13px] text-white placeholder:text-[#676767] focus:outline-none"
              style={{ background: '#0a0a0a', borderColor: '#363636' }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-white">Quantity</span>
            <input
              type="number"
              min={tier.service.minQuantity}
              max={tier.service.maxQuantity}
              value={item.quantity}
              onChange={(e) => onQuantity(Number(e.target.value))}
              aria-label="Quantity"
              className="w-full min-w-0 rounded-[3px] border px-3 py-2.5 text-[13px] text-white focus:outline-none"
              style={{ background: '#0a0a0a', borderColor: '#363636' }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `cd frontend && npx tsc --noEmit` (the PostToolUse ESLint hook runs on save). Expected: 0 errors. (Visual verification happens via E2E in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/marketing/cart-item.tsx
git commit -m "feat(frontend): CartItem component"
```

---

### Task 4: `OrderCart` component

**Files:**

- Create: `frontend/src/components/marketing/order-cart.tsx`

Owns email + provider + submit. Validates on submit (per-item link/qty + email). Uses `useMutation(checkoutLandingCart)`; on success validates the redirect host (`*.stripe.com` / `*.cryptomus.com`) like `deposit/page.tsx`, then `globalThis.location.href = url`. The `Pay` button label uses `formatUsd(cart.total)`. Empty state: "Pick a service to start."

- [ ] **Step 1: Implement `order-cart.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartItem } from './cart-item';
import { formatUsd } from '@/lib/landings/calculator';
import { checkoutLandingCart } from '@/lib/api/landings';
import { publicApiErrorMessage } from '@/lib/api/error-messages';
import type { UseCart } from '@/lib/landings/use-cart';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Provider = 'stripe' | 'cryptomus';

export function OrderCart({ slug, cart }: { slug: string; cart: UseCart }) {
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<Provider>('stripe');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      checkoutLandingCart(slug, {
        email: email.trim(),
        paymentProvider: provider,
        items: cart.items.map((i) => ({
          tierId: i.tier.id,
          link: i.link.trim(),
          quantity: i.quantity,
        })),
      }),
    onSuccess: (data) => {
      try {
        const url = new URL(data.checkoutUrl);
        const ok = url.hostname.endsWith('stripe.com') || url.hostname.endsWith('cryptomus.com');
        if (ok) globalThis.location.href = data.checkoutUrl;
        else setError('Invalid payment URL received. Please try again.');
      } catch {
        setError('Invalid payment URL format. Please try again.');
      }
    },
    onError: (err) => setError(publicApiErrorMessage(err, 'Unable to start checkout. Try again.')),
  });

  const validate = (): boolean => {
    for (const i of cart.items) {
      if (!i.link.trim()) {
        setError('Paste a link for every service.');
        return false;
      }
      if (i.quantity < i.tier.service.minQuantity) {
        setError(
          `Minimum for ${i.tier.service.name} is ${i.tier.service.minQuantity.toLocaleString()}.`,
        );
        return false;
      }
      if (i.quantity > i.tier.service.maxQuantity) {
        setError(
          `Maximum for ${i.tier.service.name} is ${i.tier.service.maxQuantity.toLocaleString()}.`,
        );
        return false;
      }
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return false;
    }
    return true;
  };

  const onPay = () => {
    setError(null);
    if (validate()) mutation.mutate();
  };

  if (cart.count === 0) {
    return (
      <div
        ref={undefined}
        className="flex h-fit min-w-0 flex-col gap-5 rounded-[5px] border p-5"
        style={{ background: '#141414', borderColor: '#363636' }}
        data-testid="order-panel"
      >
        <p className="text-sm text-muted-foreground">Pick a service to start.</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-fit min-w-0 flex-col gap-4 rounded-[5px] border p-5"
      style={{ background: '#141414', borderColor: '#363636' }}
      data-testid="order-panel"
    >
      <div className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onRemove={() => cart.removeItem(item.id)}
            onToggle={() => cart.toggleCollapse(item.id)}
            onLink={(v) => {
              cart.setLink(item.id, v);
              if (error) setError(null);
            }}
            onQuantity={(v) => cart.setQuantity(item.id, v)}
          />
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-white">Email</span>
        <Input
          type="email"
          value={email}
          placeholder="you@example.com"
          autoComplete="email"
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-white">Payment</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
          {(['stripe', 'cryptomus'] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              aria-pressed={provider === p}
              className="rounded-[3px] border px-3 py-2.5 text-[13px] font-medium text-white"
              style={{
                borderColor: provider === p ? '#FE2721' : '#363636',
                background: provider === p ? '#1f1f1f' : '#0a0a0a',
              }}
            >
              {p === 'stripe' ? 'Card' : 'Crypto'}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={onPay}
        disabled={mutation.isPending}
        aria-label={`Pay ${formatUsd(cart.total)}`}
        className="w-full"
      >
        {mutation.isPending ? 'Redirecting…' : `Pay ${formatUsd(cart.total)}`}
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-[#676767]">
        Guest checkout creates an account automatically after payment.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `cd frontend && npx tsc --noEmit` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/marketing/order-cart.tsx
git commit -m "feat(frontend): OrderCart panel (items + email + provider + pay total)"
```

---

### Task 5: slim `ServiceTiers` to catalog + wire the cart

**Files:**

- Modify: `frontend/src/components/marketing/service-tiers.tsx`

- [ ] **Step 1: Replace single-tier state with the cart.** Remove `selectedTierId`, `quantity`, `payOpen`, `calcResult`, `calcMutation`, `handlePay`, the right-panel single-item block, and the `<PaymentMethodModal>` render. Add:

```tsx
import { useCart } from '@/lib/landings/use-cart';
import { OrderCart } from './order-cart';
// ...
const cart = useCart({ defaultMinAmount });
```

- [ ] **Step 2: Card "Pay" adds to cart.** Replace `handleAddToOrder` with:

```tsx
const handleAddToOrder = (tier: LandingTierResponse) => {
  cart.addItem(tier);
  if (panelRef.current) panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
```

Keep the hero-link prefill effect but route it to the first cart item: when a hero link arrives and the cart is non-empty with an empty first link, call `cart.setLink(cart.items[0].id, link)`; if the cart is empty, store it and apply on first `addItem` (keep current sessionStorage behavior as the fallback prefill).

- [ ] **Step 3: Render the cart panel** in the right column:

```tsx
<div ref={panelRef} aria-label="Order panel">
  <OrderCart slug={slug} cart={cart} />
</div>
```

(`OrderCart` already renders `data-testid="order-panel"`; keep the `ref` wrapper for scroll-into-view.)

- [ ] **Step 4: Typecheck + existing E2E** — `cd frontend && npx tsc --noEmit`. Then run the existing home-calculator spec; some assertions change (single-tier panel → cart). Update `home-calculator.spec.ts` where it assumed a pre-selected tier (now the cart starts empty: "Pick a service to start" until a card `Pay` is clicked). Keep hero tests intact.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/marketing/service-tiers.tsx frontend/e2e/home-calculator.spec.ts
git commit -m "feat(frontend): service-tiers uses the multi-item cart panel"
```

---

### Task 6: E2E — desktop cart flow

**Files:**

- Create: `frontend/e2e/landing-cart.spec.ts`

Pattern: `home-calculator.spec.ts` (serial describe, shared page, `page.route` to mock `/checkout/cart`). No login needed.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type Page, type BrowserContext, type Route } from '@playwright/test';

const CART_CHECKOUT = /\/api\/landing\/[^/]+\/checkout\/cart$/;
let context: BrowserContext;
let page: Page;

test.describe.serial('Landing cart', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });
  test.beforeEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
    await page.goto('/');
    await expect(page.getByTestId('order-panel')).toBeVisible({ timeout: 10_000 });
  });

  const cards = () => page.locator('[data-tier-card]');
  const panel = () => page.getByTestId('order-panel');

  test('empty cart shows the empty state', async () => {
    await expect(panel()).toContainText(/pick a service/i);
  });

  test('adding two services shows two items and a summed Pay total', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards().nth(1).getByRole('button', { name: /^pay$/i }).click();
    await expect(panel().getByLabel(/add a link/i)).toHaveCount(2);
    await expect(panel().getByRole('button', { name: /pay \$\d/i })).toBeVisible();
  });

  test('removing an item drops it; emptying returns to empty state', async () => {
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await panel()
      .getByRole('button', { name: /remove item/i })
      .first()
      .click();
    await expect(panel()).toContainText(/pick a service/i);
  });

  test('invalid email blocks checkout; valid cart posts items and redirects', async () => {
    const captured: { body: unknown } = { body: null };
    await page.route(CART_CHECKOUT, async (route: Route) => {
      captured.body = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u',
          paymentId: 'p',
          orderIds: ['o1', 'o2'],
          checkoutUrl: 'https://checkout.stripe.com/x',
        }),
      });
    });
    await cards().nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards().nth(1).getByRole('button', { name: /^pay$/i }).click();
    for (const inp of await panel()
      .getByLabel(/add a link/i)
      .all())
      await inp.fill('https://youtube.com/watch?v=abc');
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click(); // no email yet
    await expect(panel().getByRole('alert')).toContainText(/valid email/i);
    await panel()
      .getByPlaceholder(/you@example/i)
      .fill('a@b.com');
    await panel()
      .getByRole('button', { name: /pay \$/i })
      .click();
    await expect.poll(() => captured.body).not.toBeNull();
    expect((captured.body as { items: unknown[] }).items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it** — stop Docker frontend, start local dev (Node 22), then `cd frontend && npx playwright test landing-cart --project=chromium`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/landing-cart.spec.ts
git commit -m "test(e2e): landing cart desktop flow"
```

---

### Task 7: E2E — mobile overflow with multiple long links

**Files:**

- Create: `frontend/e2e/mobile-cart.spec.ts`

Pattern: `mobile-landing.spec.ts` (mobile-chrome project, `docOverflow` helper). Guards the cart against horizontal overflow with several pathological links.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const LONG = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL' + 'x'.repeat(160) + '&index=1';
let context: BrowserContext;
let page: Page;
const panel = () => page.getByTestId('order-panel');
const docOverflow = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe.serial('Mobile cart layout', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('multiple long links across items cause no horizontal overflow', async () => {
    await page.goto('/');
    await expect(panel()).toBeVisible({ timeout: 10_000 });
    const cards = page.locator('[data-tier-card]');
    await cards.nth(0).getByRole('button', { name: /^pay$/i }).click();
    await cards.nth(1).getByRole('button', { name: /^pay$/i }).click();
    for (const inp of await panel()
      .getByLabel(/add a link/i)
      .all())
      await inp.fill(LONG);
    expect(await docOverflow(page)).toBeLessThanOrEqual(1);
    const payBtn = panel().getByRole('button', { name: /pay \$/i });
    const box = await payBtn.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
  });
});
```

- [ ] **Step 2: Run it** — `cd frontend && npx playwright test mobile-cart --project=mobile-chrome`. Expected: PASS. If overflow > 1, fix the `min-w-0`/`truncate` chain in `cart-item.tsx` / `order-cart.tsx` and re-run.

- [ ] **Step 3: Full frontend verification**

Run: `cd frontend && npx tsc --noEmit && npx jest && npx playwright test landing-cart mobile-cart home-calculator mobile-landing`
Expected: typecheck clean, unit green, all listed E2E green.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/mobile-cart.spec.ts
git commit -m "test(e2e): mobile cart has no horizontal overflow with long links"
```

---

## Self-review checklist (run before handing off)

- [ ] Spec frontend requirements covered: cart hook (T2), CartItem (T3), OrderCart inline email/provider/pay (T4), card Pay→add + slim service-tiers (T5), duplicates allowed (T2 test), 20-item cap (T2), live local total (T2/T4), empty state (T4/T6), desktop E2E (T6), mobile overflow E2E (T7).
- [ ] No placeholders; types match the backend contract (`LandingCartCheckoutBody.items[].tierId/link/quantity`, result `checkoutUrl`).
- [ ] `min-w-0`/`truncate` mobile-safety applied in CartItem + OrderCart (regression of the 2026-05-28 mobile fix).
- [ ] Final: `npx tsc --noEmit` + `npx jest` + the four E2E specs all green.
