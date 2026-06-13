import type { LandingResponse, LandingTierResponse } from '@/lib/api/types';

export function pickDefaultTier(
  tiers: LandingResponse['tiers'],
  defaultServiceId: string | null,
): LandingResponse['tiers'][number] | null {
  if (tiers.length === 0) return null;
  if (defaultServiceId) {
    const match = tiers.find((t) => t.serviceId === defaultServiceId);
    if (match) return match;
  }
  const sale = tiers.find((t) => t.pillKind === 'SALE');
  if (sale) return sale;
  // Non-empty (guarded above); `?? null` satisfies noUncheckedIndexedAccess.
  return tiers[0] ?? null;
}

/** Effective price per 1000 units: landing override wins over the service price. */
export function unitPrice(tier: LandingTierResponse): number {
  return tier.priceOverride ?? tier.service.pricePer1000;
}

export function defaultQtyForTier(tier: LandingTierResponse, defaultMinAmount: number): number {
  const preferred = Math.max(tier.service.minQuantity, 1000);
  const price = unitPrice(tier);
  if (price <= 0) return preferred;
  const qtyForMinAmount = Math.ceil((defaultMinAmount / price) * 1000);
  return Math.max(preferred, qtyForMinAmount);
}

export function estimatePrice(tier: LandingTierResponse, quantity: number): number {
  return Math.round(((unitPrice(tier) * quantity) / 1000) * 100) / 100;
}
