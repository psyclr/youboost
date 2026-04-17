import { z } from 'zod/v4';

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['USER', 'RESELLER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
});

export const adminUserIdSchema = z.object({
  userId: z.uuid(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(['USER', 'RESELLER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
});

export const adminBalanceAdjustSchema = z.object({
  amount: z.coerce.number(),
  reason: z.string().min(1).max(500),
});

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'CANCELLED', 'FAILED', 'REFUNDED'])
    .optional(),
  userId: z.uuid().optional(),
  isDripFeed: z.coerce.boolean().optional(),
});

export const adminOrderIdSchema = z.object({
  orderId: z.uuid(),
});

export const adminForceStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'PARTIAL',
    'CANCELLED',
    'FAILED',
    'REFUNDED',
  ]),
});

export const adminServicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminServiceCreateSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK']),
    type: z.enum(['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES']),
    pricePer1000: z.coerce.number().min(0),
    minQuantity: z.coerce.number().int().min(1),
    maxQuantity: z.coerce.number().int().min(1),
    providerId: z.uuid(),
    externalServiceId: z.string().min(1),
  })
  .refine((data) => data.maxQuantity >= data.minQuantity, {
    message: 'maxQuantity must be >= minQuantity',
    path: ['maxQuantity'],
  });

export const adminServiceUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK']).optional(),
    type: z.enum(['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES']).optional(),
    pricePer1000: z.coerce.number().min(0).optional(),
    minQuantity: z.coerce.number().int().min(1).optional(),
    maxQuantity: z.coerce.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
    providerId: z.uuid().optional(),
    externalServiceId: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.minQuantity != null && data.maxQuantity != null) {
        return data.maxQuantity >= data.minQuantity;
      }
      return true;
    },
    {
      message: 'maxQuantity must be >= minQuantity',
      path: ['maxQuantity'],
    },
  );

export const adminServiceIdSchema = z.object({
  serviceId: z.uuid(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserIdParam = z.infer<typeof adminUserIdSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminBalanceAdjustInput = z.infer<typeof adminBalanceAdjustSchema>;
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
export type AdminOrderIdParam = z.infer<typeof adminOrderIdSchema>;
export type AdminForceStatusInput = z.infer<typeof adminForceStatusSchema>;
export type AdminServicesQuery = z.infer<typeof adminServicesQuerySchema>;
export type AdminServiceCreateInput = z.infer<typeof adminServiceCreateSchema>;
export type AdminServiceUpdateInput = z.infer<typeof adminServiceUpdateSchema>;
export const adminDepositsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED']).optional(),
  userId: z.uuid().optional(),
});

export const adminDepositIdSchema = z.object({
  depositId: z.uuid(),
});

export type AdminDepositsQuery = z.infer<typeof adminDepositsQuerySchema>;
export type AdminDepositIdParam = z.infer<typeof adminDepositIdSchema>;
export type AdminServiceIdParam = z.infer<typeof adminServiceIdSchema>;

export interface AdminUserResponse {
  userId: string;
  email: string;
  username: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
  wallet: {
    balance: number;
    frozen: number;
    available: number;
  } | null;
}

export interface AdminOrderResponse {
  orderId: string;
  userId: string;
  serviceId: string;
  status: string;
  quantity: number;
  price: number;
  link: string;
  startCount: number | null;
  remains: number | null;
  isDripFeed: boolean;
  dripFeedRuns: number | null;
  dripFeedRunsCompleted: number;
  dripFeedInterval: number | null;
  dripFeedPausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface AdminServiceResponse {
  serviceId: string;
  name: string;
  description: string | null;
  platform: string;
  type: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  providerId: string | null;
  externalServiceId: string | null;
  providerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  activeServices: number;
  recentOrders: AdminOrderResponse[];
}

export interface PaginatedUsers {
  users: AdminUserResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedAdminOrders {
  orders: AdminOrderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
