import { z } from 'zod';

/**
 * Client-side zod schemas for the admin create/edit forms. Each schema mirrors
 * the backend route schema so the form rejects the same inputs the API would
 * reject (with friendlier messages), instead of bouncing off a 400.
 *
 * Backend references:
 * - service:  src/modules/admin/admin.types.ts (adminServiceCreateSchema)
 * - provider: src/modules/providers/providers.types.ts (createProviderSchema)
 * - coupon:   src/modules/coupons/coupons.types.ts (createCouponSchema)
 * - tracking: src/modules/tracking/tracking.types.ts (createTrackingLinkSchema)
 */

const platformEnum = z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK']);
const serviceTypeEnum = z.enum(['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES']);

/**
 * Service form. Numeric fields are kept as strings in the form (native number
 * inputs emit strings) and coerced/validated here, matching the backend's
 * `z.coerce.number()` usage. `description` is optional and may be empty —
 * the empty string clears the description server-side.
 */
export const serviceFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
    description: z.string().max(1000, 'Description must be at most 1000 characters'),
    platform: platformEnum,
    type: serviceTypeEnum,
    pricePer1000: z
      .string()
      .min(1, 'Price is required')
      .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, 'Price must be 0 or more'),
    minQuantity: z
      .string()
      .min(1, 'Minimum quantity is required')
      .refine(
        (v) => Number.isInteger(Number(v)) && Number(v) >= 1,
        'Minimum quantity must be a whole number of at least 1',
      ),
    maxQuantity: z
      .string()
      .min(1, 'Maximum quantity is required')
      .refine(
        (v) => Number.isInteger(Number(v)) && Number(v) >= 1,
        'Maximum quantity must be a whole number of at least 1',
      ),
    providerId: z.string().min(1, 'Select a provider'),
    externalServiceId: z.string().min(1, 'Select a provider service'),
  })
  .refine((data) => Number(data.maxQuantity) >= Number(data.minQuantity), {
    message: 'Maximum quantity must be greater than or equal to minimum quantity',
    path: ['maxQuantity'],
  });

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export const defaultServiceFormValues: ServiceFormValues = {
  name: '',
  description: '',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: '',
  minQuantity: '100',
  maxQuantity: '100000',
  providerId: '',
  externalServiceId: '',
};

/**
 * Provider form. `apiKey` is required on create but optional on edit (an empty
 * value keeps the existing key). The field type stays a plain string in both
 * modes (so the form value type is uniform); create-mode requiredness is
 * enforced with a superRefine instead of changing the field's type.
 */
export function buildProviderFormSchema(mode: 'create' | 'edit') {
  return z
    .object({
      name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
      apiEndpoint: z.url('Enter a valid URL'),
      apiKey: z.string(),
      priority: z
        .string()
        .min(1, 'Priority is required')
        .refine((v) => Number.isInteger(Number(v)), 'Priority must be a whole number'),
    })
    .superRefine((data, ctx) => {
      if (mode === 'create' && data.apiKey.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'API key is required',
          path: ['apiKey'],
        });
      }
    });
}

export type ProviderFormValues = z.infer<ReturnType<typeof buildProviderFormSchema>>;

export const defaultProviderFormValues: ProviderFormValues = {
  name: '',
  apiEndpoint: '',
  apiKey: '',
  priority: '0',
};

/**
 * Coupon form. Optional numeric/date fields are blank-allowed strings; the
 * submit handler omits them when empty so they map to the backend optionals.
 */
export const couponFormSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(50, 'Code must be at most 50 characters')
      .regex(/^[A-Z0-9_-]+$/i, 'Only letters, numbers, dashes and underscores'),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z
      .string()
      .min(1, 'Discount value is required')
      .refine((v) => Number(v) > 0, 'Discount value must be greater than 0'),
    maxUses: z
      .string()
      .refine(
        (v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 1),
        'Max uses must be a whole number of at least 1',
      ),
    minOrderAmount: z
      .string()
      .refine((v) => v === '' || Number(v) > 0, 'Min order amount must be greater than 0'),
    expiresAt: z.string(),
  })
  .refine(
    (data) => data.discountType !== 'PERCENTAGE' || Number(data.discountValue) <= 100,
    { message: 'Percentage discount cannot exceed 100', path: ['discountValue'] },
  );

export type CouponFormValues = z.infer<typeof couponFormSchema>;

export const defaultCouponFormValues: CouponFormValues = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxUses: '',
  minOrderAmount: '',
  expiresAt: '',
};

/**
 * Tracking link form. Code is normalized to the backend-allowed charset by the
 * input handler; the schema enforces length and charset.
 */
export const trackingFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  code: z
    .string()
    .min(3, 'Code must be at least 3 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, dashes and underscores'),
});

export type TrackingFormValues = z.infer<typeof trackingFormSchema>;

export const defaultTrackingFormValues: TrackingFormValues = {
  name: '',
  code: '',
};
