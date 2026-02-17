import { z } from 'zod/v4';

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['USER', 'RESELLER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
});

export const adminUserIdSchema = z.object({
  userId: z.string().uuid(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(['USER', 'RESELLER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
});

export const adminBalanceAdjustSchema = z.object({
  amount: z.number(),
  reason: z.string().min(1).max(500),
});

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'CANCELLED', 'FAILED', 'REFUNDED'])
    .optional(),
  userId: z.string().uuid().optional(),
});

export const adminOrderIdSchema = z.object({
  orderId: z.string().uuid(),
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

export const adminServiceCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK']),
  type: z.enum(['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES']),
  pricePer1000: z.number().min(0),
  minQuantity: z.number().int().min(1),
  maxQuantity: z.number().int().min(1),
});

export const adminServiceUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  platform: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK']).optional(),
  type: z.enum(['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES']).optional(),
  pricePer1000: z.number().min(0).optional(),
  minQuantity: z.number().int().min(1).optional(),
  maxQuantity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const adminServiceIdSchema = z.object({
  serviceId: z.string().uuid(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserIdParam = z.infer<typeof adminUserIdSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminBalanceAdjustInput = z.infer<typeof adminBalanceAdjustSchema>;
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;
export type AdminOrderIdParam = z.infer<typeof adminOrderIdSchema>;
export type AdminForceStatusInput = z.infer<typeof adminForceStatusSchema>;
export type AdminServiceCreateInput = z.infer<typeof adminServiceCreateSchema>;
export type AdminServiceUpdateInput = z.infer<typeof adminServiceUpdateSchema>;
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
