import { apiRequest } from './client';

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

export interface PaginatedCoupons {
  coupons: CouponResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

export const adminListCoupons = (params?: { page?: number; isActive?: boolean }) => {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.isActive !== undefined) sp.set('isActive', String(params.isActive));
  const qs = sp.toString();
  return apiRequest<PaginatedCoupons>(`/admin/coupons${qs ? `?${qs}` : ''}`);
};

export const adminDeleteCoupon = (couponId: string) =>
  apiRequest<void>(`/admin/coupons/${couponId}`, { method: 'DELETE' });
