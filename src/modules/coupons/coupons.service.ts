import type { Logger } from 'pino';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import type { CouponsRepository } from './coupons.repository';
import type {
  CreateCouponInput,
  CouponResponse,
  PaginatedCoupons,
  ValidateCouponResult,
  CouponQuery,
} from './coupons.types';

export interface CouponsService {
  createCoupon(input: CreateCouponInput): Promise<CouponResponse>;
  validateCoupon(code: string, orderAmount?: number): Promise<ValidateCouponResult>;
  applyCoupon(couponId: string): Promise<void>;
  listCoupons(query: CouponQuery): Promise<PaginatedCoupons>;
  deactivateCoupon(couponId: string): Promise<void>;
}

export interface CouponsServiceDeps {
  couponsRepo: CouponsRepository;
  logger: Logger;
}

function toCouponResponse(coupon: {
  id: string;
  code: string;
  discountType: string;
  discountValue: { toNumber?: () => number } | number;
  maxUses: number | null;
  usedCount: number;
  minOrderAmount: { toNumber?: () => number } | number | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}): CouponResponse {
  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    minOrderAmount: coupon.minOrderAmount == null ? null : Number(coupon.minOrderAmount),
    expiresAt: coupon.expiresAt,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt,
  };
}

function createInvalidResult(reason: string): ValidateCouponResult {
  return {
    valid: false,
    discount: 0,
    couponId: null,
    discountType: null,
    discountValue: null,
    reason,
  };
}

function checkCouponAvailability(
  coupon: {
    isActive: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    usedCount: number;
    minOrderAmount: { toNumber?: () => number } | number | null;
  },
  orderAmount?: number,
): string | null {
  if (!coupon.isActive) {
    return 'Coupon is inactive';
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return 'Coupon has expired';
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return 'Coupon usage limit reached';
  }

  const minOrder = coupon.minOrderAmount == null ? null : Number(coupon.minOrderAmount);
  if (minOrder != null && orderAmount != null && orderAmount < minOrder) {
    return `Minimum order amount is $${minOrder.toFixed(2)}`;
  }

  return null;
}

function calculateDiscount(
  discountType: string,
  discountValue: number,
  orderAmount?: number,
): number {
  if (orderAmount == null) {
    return 0;
  }

  let discount = 0;
  if (discountType === 'PERCENTAGE') {
    discount = (orderAmount * discountValue) / 100;
    discount = Math.min(discount, orderAmount);
  } else {
    discount = Math.min(discountValue, orderAmount);
  }

  return Math.round(discount * 100) / 100;
}

export function createCouponsService(deps: CouponsServiceDeps): CouponsService {
  const { couponsRepo, logger } = deps;

  async function createCoupon(input: CreateCouponInput): Promise<CouponResponse> {
    const existing = await couponsRepo.findCouponByCode(input.code);
    if (existing) {
      throw new ConflictError('Coupon code already exists', 'COUPON_CODE_EXISTS');
    }

    if (input.discountType === 'PERCENTAGE' && input.discountValue > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100', 'INVALID_DISCOUNT_VALUE');
    }

    const createData: Parameters<CouponsRepository['createCoupon']>[0] = {
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
    };
    if (input.maxUses != null) createData.maxUses = input.maxUses;
    if (input.minOrderAmount != null) createData.minOrderAmount = input.minOrderAmount;
    if (input.expiresAt) createData.expiresAt = new Date(input.expiresAt);

    const coupon = await couponsRepo.createCoupon(createData);

    logger.info({ couponId: coupon.id, code: coupon.code }, 'Coupon created');
    return toCouponResponse(coupon);
  }

  async function validateCoupon(code: string, orderAmount?: number): Promise<ValidateCouponResult> {
    const coupon = await couponsRepo.findCouponByCode(code);

    if (!coupon) {
      return createInvalidResult('Coupon not found');
    }

    const availabilityError = checkCouponAvailability(coupon, orderAmount);
    if (availabilityError) {
      return createInvalidResult(availabilityError);
    }

    const discountValue = Number(coupon.discountValue);
    const discount = calculateDiscount(coupon.discountType, discountValue, orderAmount);

    return {
      valid: true,
      discount,
      couponId: coupon.id,
      discountType: coupon.discountType,
      discountValue,
    };
  }

  async function applyCoupon(couponId: string): Promise<void> {
    const coupon = await couponsRepo.findCouponById(couponId);
    if (!coupon) {
      throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    await couponsRepo.incrementUsedCount(couponId);
    logger.info({ couponId }, 'Coupon usage incremented');
  }

  async function listCoupons(query: CouponQuery): Promise<PaginatedCoupons> {
    const listFilters: Parameters<CouponsRepository['listCoupons']>[0] = {
      page: query.page,
      limit: query.limit,
    };
    if (query.isActive != null) listFilters.isActive = query.isActive;

    const { coupons, total } = await couponsRepo.listCoupons(listFilters);

    return {
      coupons: coupons.map(toCouponResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async function deactivateCoupon(couponId: string): Promise<void> {
    const coupon = await couponsRepo.findCouponById(couponId);
    if (!coupon) {
      throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND');
    }

    await couponsRepo.deactivateCoupon(couponId);
    logger.info({ couponId }, 'Coupon deactivated');
  }

  return {
    createCoupon,
    validateCoupon,
    applyCoupon,
    listCoupons,
    deactivateCoupon,
  };
}
