import { renderHook, act } from '@testing-library/react';
import { useCart } from '../use-cart';
import type { LandingTierResponse } from '../../api/types';

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
  expect(result.current.items[0]!.collapsed).toBe(false);
  expect(result.current.total).toBeGreaterThan(0);
});

it('seeds the link from opts when provided', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1), { link: 'https://x' }));
  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0]!.link).toBe('https://x');
});

it('allows the same service twice as independent items', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => {
    result.current.addItem(tier('1', 1));
    result.current.addItem(tier('1', 1));
  });
  expect(result.current.items).toHaveLength(2);
  expect(result.current.items[0]!.id).not.toBe(result.current.items[1]!.id);
});

it('total is the sum of per-item estimates', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => {
    result.current.addItem(tier('1', 2));
    result.current.addItem(tier('2', 3));
  });
  act(() => {
    result.current.setQuantity(result.current.items[0]!.id, 1000);
    result.current.setQuantity(result.current.items[1]!.id, 1000);
  });
  expect(result.current.total).toBeCloseTo(5, 2);
});

it('coerces a NaN quantity to 0 so the total never becomes NaN', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 2)));
  const id = result.current.items[0]!.id;
  act(() => result.current.setQuantity(id, Number.NaN));
  expect(result.current.items[0]!.quantity).toBe(0);
  expect(Number.isNaN(result.current.total)).toBe(false);
  expect(result.current.total).toBe(0);
});

it('flags an item below its tier minimum and clears the flag at/above min', () => {
  // Tier min is 1000; defaultMinAmount seeds a valid (>= min) quantity.
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1, 1000)));
  const id = result.current.items[0]!.id;
  // Default-added quantity meets the minimum.
  expect(result.current.items[0]!.belowMin).toBe(false);
  expect(result.current.hasBelowMin).toBe(false);

  // Drop below the tier minimum -> flagged.
  act(() => result.current.setQuantity(id, 999));
  expect(result.current.items[0]!.belowMin).toBe(true);
  expect(result.current.hasBelowMin).toBe(true);

  // Exactly at the minimum is acceptable.
  act(() => result.current.setQuantity(id, 1000));
  expect(result.current.items[0]!.belowMin).toBe(false);
  expect(result.current.hasBelowMin).toBe(false);
});

it('hasBelowMin is true if ANY item is below its minimum', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => {
    result.current.addItem(tier('1', 1, 1000));
    result.current.addItem(tier('2', 1, 1000));
  });
  act(() => {
    result.current.setQuantity(result.current.items[0]!.id, 1000); // ok
    result.current.setQuantity(result.current.items[1]!.id, 10); // below min
  });
  expect(result.current.items[0]!.belowMin).toBe(false);
  expect(result.current.items[1]!.belowMin).toBe(true);
  expect(result.current.hasBelowMin).toBe(true);
});

it('a NaN-coerced (0) quantity counts as below min', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1, 1000)));
  const id = result.current.items[0]!.id;
  act(() => result.current.setQuantity(id, Number.NaN));
  expect(result.current.items[0]!.quantity).toBe(0);
  expect(result.current.items[0]!.belowMin).toBe(true);
  expect(result.current.hasBelowMin).toBe(true);
});

it('removes an item; empty cart has total 0 and count 0', () => {
  const { result } = renderHook(() => useCart({ defaultMinAmount: 5 }));
  act(() => result.current.addItem(tier('1', 1)));
  const id = result.current.items[0]!.id;
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
  const id = result.current.items[0]!.id;
  act(() => {
    result.current.setLink(id, 'https://x/1');
    result.current.toggleCollapse(id);
  });
  expect(result.current.items[0]!.link).toBe('https://x/1');
  expect(result.current.items[0]!.collapsed).toBe(true);
});
