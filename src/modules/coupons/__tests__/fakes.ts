import type { CouponsRepository } from '../coupons.repository';
import type { Coupon } from '../../../generated/prisma';

export interface FakeCouponsRepoCalls {
  createCoupon: Array<{
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    maxUses?: number;
    minOrderAmount?: number;
    expiresAt?: Date;
  }>;
  findCouponByCode: string[];
  findCouponById: string[];
  listCoupons: Array<{ page: number; limit: number; isActive?: boolean }>;
  incrementUsedCount: string[];
  deactivateCoupon: string[];
}

export function createFakeCouponsRepository(
  seed: {
    coupons?: Coupon[];
    listResult?: { coupons: Coupon[]; total: number };
  } = {},
): CouponsRepository & { calls: FakeCouponsRepoCalls } {
  const byId = new Map((seed.coupons ?? []).map((c) => [c.id, c]));
  const byCode = new Map((seed.coupons ?? []).map((c) => [c.code, c]));
  const calls: FakeCouponsRepoCalls = {
    createCoupon: [],
    findCouponByCode: [],
    findCouponById: [],
    listCoupons: [],
    incrementUsedCount: [],
    deactivateCoupon: [],
  };

  return {
    async createCoupon(data) {
      calls.createCoupon.push(data);
      const coupon: Coupon = {
        id: `coupon-${byId.size + 1}`,
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses ?? null,
        usedCount: 0,
        minOrderAmount: data.minOrderAmount ?? null,
        expiresAt: data.expiresAt ?? null,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      byId.set(coupon.id, coupon);
      byCode.set(coupon.code, coupon);
      return coupon;
    },
    async findCouponByCode(code) {
      calls.findCouponByCode.push(code);
      return byCode.get(code) ?? null;
    },
    async findCouponById(id) {
      calls.findCouponById.push(id);
      return byId.get(id) ?? null;
    },
    async listCoupons(filters) {
      calls.listCoupons.push(filters);
      return seed.listResult ?? { coupons: [], total: 0 };
    },
    async incrementUsedCount(couponId) {
      calls.incrementUsedCount.push(couponId);
    },
    async deactivateCoupon(couponId) {
      calls.deactivateCoupon.push(couponId);
    },
    calls,
  };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
