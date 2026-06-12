import { apiRequest, apiRequestVoid } from './client';
import { buildQuery } from './query';
import type { Paginated } from './types';

export interface ValidateCouponResult {
  valid: boolean;
  discount: number;
  couponId: string | null;
  discountType: string | null;
  discountValue: number | null;
  reason?: string;
}

export interface CouponResponse {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  minOrderAmount: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export type PaginatedCoupons = Paginated<'coupons', CouponResponse>;

export interface CreateCouponInput {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxUses?: number;
  minOrderAmount?: number;
  expiresAt?: string;
}

// User-facing
export const validateCoupon = (code: string, orderAmount?: number) =>
  apiRequest<ValidateCouponResult>('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, orderAmount }),
  });

// Admin
export const adminCreateCoupon = (data: CreateCouponInput) =>
  apiRequest<CouponResponse>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const adminListCoupons = (params?: { page?: number; isActive?: boolean }) =>
  apiRequest<PaginatedCoupons>(
    `/admin/coupons${buildQuery({
      page: params?.page || undefined,
      isActive: params?.isActive,
    })}`,
  );

export const adminDeleteCoupon = (couponId: string) =>
  apiRequestVoid(`/admin/coupons/${couponId}`, { method: 'DELETE' });
