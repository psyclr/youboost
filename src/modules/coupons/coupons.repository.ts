import { getPrisma } from '../../shared/database';
import type { Coupon, PrismaClient } from '../../generated/prisma';

export interface CouponsRepository {
  createCoupon(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    maxUses?: number;
    minOrderAmount?: number;
    expiresAt?: Date;
  }): Promise<Coupon>;
  findCouponByCode(code: string): Promise<Coupon | null>;
  findCouponById(id: string): Promise<Coupon | null>;
  listCoupons(filters: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ coupons: Coupon[]; total: number }>;
  incrementUsedCount(couponId: string): Promise<void>;
  deactivateCoupon(couponId: string): Promise<void>;
}

export function createCouponsRepository(prisma: PrismaClient): CouponsRepository {
  async function createCoupon(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    maxUses?: number;
    minOrderAmount?: number;
    expiresAt?: Date;
  }): Promise<Coupon> {
    return prisma.coupon.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses ?? null,
        minOrderAmount: data.minOrderAmount ?? null,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  async function findCouponByCode(code: string): Promise<Coupon | null> {
    return prisma.coupon.findUnique({ where: { code } });
  }

  async function findCouponById(id: string): Promise<Coupon | null> {
    return prisma.coupon.findUnique({ where: { id } });
  }

  async function listCoupons(filters: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ coupons: Coupon[]; total: number }> {
    const where: { isActive?: boolean } = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.coupon.count({ where }),
    ]);

    return { coupons, total };
  }

  async function incrementUsedCount(couponId: string): Promise<void> {
    await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  async function deactivateCoupon(couponId: string): Promise<void> {
    await prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    });
  }

  return {
    createCoupon,
    findCouponByCode,
    findCouponById,
    listCoupons,
    incrementUsedCount,
    deactivateCoupon,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createCoupon(data: {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxUses?: number;
  minOrderAmount?: number;
  expiresAt?: Date;
}): Promise<Coupon> {
  return createCouponsRepository(getPrisma()).createCoupon(data);
}

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  return createCouponsRepository(getPrisma()).findCouponByCode(code);
}

export async function findCouponById(id: string): Promise<Coupon | null> {
  return createCouponsRepository(getPrisma()).findCouponById(id);
}

export async function listCoupons(filters: {
  page: number;
  limit: number;
  isActive?: boolean;
}): Promise<{ coupons: Coupon[]; total: number }> {
  return createCouponsRepository(getPrisma()).listCoupons(filters);
}

export async function incrementUsedCount(couponId: string): Promise<void> {
  return createCouponsRepository(getPrisma()).incrementUsedCount(couponId);
}

export async function deactivateCoupon(couponId: string): Promise<void> {
  return createCouponsRepository(getPrisma()).deactivateCoupon(couponId);
}
