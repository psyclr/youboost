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
  return tiers[0];
}

export function defaultQtyForTier(tier: LandingTierResponse, defaultMinAmount: number): number {
  const preferred = Math.max(tier.service.minQuantity, 1000);
  const unitPrice = tier.priceOverride ?? tier.service.pricePer1000;
  if (unitPrice <= 0) return preferred;
  const qtyForMinAmount = Math.ceil((defaultMinAmount / unitPrice) * 1000);
  return Math.max(preferred, qtyForMinAmount);
}

export function estimatePrice(tier: LandingTierResponse, quantity: number): number {
  const unitPrice = tier.priceOverride ?? tier.service.pricePer1000;
  return Math.round(((unitPrice * quantity) / 1000) * 100) / 100;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}
