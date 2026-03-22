import { getPrisma } from '../../shared/database';
import type { Coupon } from '../../generated/prisma';

export async function createCoupon(data: {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxUses?: number;
  minOrderAmount?: number;
  expiresAt?: Date;
}): Promise<Coupon> {
  const prisma = getPrisma();
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

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  const prisma = getPrisma();
  return prisma.coupon.findUnique({ where: { code } });
}

export async function findCouponById(id: string): Promise<Coupon | null> {
  const prisma = getPrisma();
  return prisma.coupon.findUnique({ where: { id } });
}

export async function listCoupons(filters: {
  page: number;
  limit: number;
  isActive?: boolean;
}): Promise<{ coupons: Coupon[]; total: number }> {
  const prisma = getPrisma();
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

export async function incrementUsedCount(couponId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });
}

export async function deactivateCoupon(couponId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: false },
  });
}
