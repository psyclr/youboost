import { useMemo, useState, useCallback } from 'react';
import type { LandingTierResponse } from '../api/types';
import { estimatePrice, defaultQtyForTier } from './calculator';
import { analytics } from '../analytics';

const MAX_ITEMS = 20;

export interface CartItem {
  id: string;
  tier: LandingTierResponse;
  link: string;
  quantity: number;
  collapsed: boolean;
}

/**
 * A cart item enriched with derived UI state. `belowMin` is true when the typed
 * quantity is under the tier's service minimum — the same threshold the
 * checkout `validate()` enforces server-side (`tier.service.minQuantity`). The
 * panel uses it to flag the item and disable Pay without re-deriving the rule.
 */
export interface CartItemView extends CartItem {
  belowMin: boolean;
}

export interface UseCart {
  items: CartItemView[];
  count: number;
  total: number;
  /** True when any item's quantity is below its tier minimum. */
  hasBelowMin: boolean;
  addItem: (tier: LandingTierResponse, opts?: { link?: string }) => void;
  removeItem: (id: string) => void;
  setLink: (id: string, link: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  toggleCollapse: (id: string) => void;
}

/** Minimum quantity a tier accepts — the single source of truth for "below min". */
export function tierMinQuantity(tier: LandingTierResponse): number {
  return tier.service.minQuantity;
}

export function useCart({ defaultMinAmount }: { defaultMinAmount: number }): UseCart {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (tier: LandingTierResponse, opts?: { link?: string }) => {
      const quantity = defaultQtyForTier(tier, defaultMinAmount);
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${prev.length}`;
        return [...prev, { id, tier, link: opts?.link ?? '', quantity, collapsed: false }];
      });
      analytics.addToCart({
        id: tier.id,
        name: tier.titleOverride ?? tier.service.name,
        price: estimatePrice(tier, quantity),
        quantity,
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
      setItems((p) =>
        // Guard against NaN from an emptied/invalid number input so the live
        // total never becomes NaN ("Pay $NaN").
        p.map((i) =>
          i.id === id ? { ...i, quantity: Number.isFinite(quantity) ? quantity : 0 } : i,
        ),
      ),
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

  // Enrich each item with a derived `belowMin` flag (below the tier minimum) so
  // the panel can flag it and gate Pay. We don't clamp the typed value — only
  // surface the state — to avoid fighting the quantity input.
  const views = useMemo<CartItemView[]>(
    () => items.map((i) => ({ ...i, belowMin: i.quantity < tierMinQuantity(i.tier) })),
    [items],
  );

  const hasBelowMin = useMemo(() => views.some((i) => i.belowMin), [views]);

  return {
    items: views,
    count: views.length,
    total,
    hasBelowMin,
    addItem,
    removeItem,
    setLink,
    setQuantity,
    toggleCollapse,
  };
}
