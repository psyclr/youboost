import { z } from 'zod/v4';

export const createCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  minOrderAmount: z.number().positive().optional(),
  expiresAt: z.iso.datetime().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  orderAmount: z.number().positive().optional(),
});

export const couponQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.coerce.boolean().optional(),
});

export const couponIdSchema = z.object({
  couponId: z.uuid(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type CouponQuery = z.infer<typeof couponQuerySchema>;

export interface CouponResponse {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  minOrderAmount: number | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
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

export interface ValidateCouponResult {
  valid: boolean;
  discount: number;
  couponId: string | null;
  discountType: string | null;
  discountValue: number | null;
  reason?: string;
}
