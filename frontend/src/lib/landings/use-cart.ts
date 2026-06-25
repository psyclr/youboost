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

export interface UseCart {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (tier: LandingTierResponse, opts?: { link?: string }) => void;
  removeItem: (id: string) => void;
  setLink: (id: string, link: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  toggleCollapse: (id: string) => void;
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
