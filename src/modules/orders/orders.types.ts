import { z } from 'zod/v4';

export const createOrderSchema = z
  .object({
    serviceId: z.string().uuid(),
    link: z.string().url(),
    quantity: z.number().int().min(1),
    comments: z.string().max(500).optional(),
    isDripFeed: z.boolean().default(false),
    dripFeedRuns: z.number().int().min(2).max(100).optional(),
    dripFeedInterval: z.number().int().min(10).max(10080).optional(),
    couponCode: z.string().min(1).optional(),
  })
  .refine((data) => !data.isDripFeed || (data.dripFeedRuns && data.dripFeedInterval), {
    message: 'Drip-feed requires runs and interval',
    path: ['dripFeedRuns'],
  });

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'CANCELLED', 'FAILED', 'REFUNDED'])
    .optional(),
  serviceId: z.string().uuid().optional(),
});

export const orderIdSchema = z.object({
  orderId: z.string().uuid(),
});

export const refillOrderSchema = z.object({
  orderId: z.string().uuid(),
});

export const bulkOrderSchema = z.object({
  serviceId: z.string().uuid(),
  links: z
    .array(
      z.object({
        link: z.string().url(),
        quantity: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(500),
  defaultQuantity: z.number().int().min(1),
  comments: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type OrderIdParam = z.infer<typeof orderIdSchema>;
export type RefillOrderInput = z.infer<typeof refillOrderSchema>;
export type BulkOrderInput = z.infer<typeof bulkOrderSchema>;

export interface OrderResponse {
  orderId: string;
  serviceId: string;
  status: string;
  quantity: number;
  completed: number;
  price: number;
  createdAt: Date;
  isDripFeed: boolean;
}

export interface OrderDetailed extends OrderResponse {
  link: string;
  startCount: number | null;
  remains: number | null;
  updatedAt: Date;
  comments: string | null;
  dripFeedRuns: number | null;
  dripFeedInterval: number | null;
  dripFeedRunsCompleted: number;
  refillEligibleUntil: Date | null;
  refillCount: number;
}

export interface CancelOrderResponse {
  orderId: string;
  status: string;
  refundAmount: number;
  cancelledAt: Date;
}

export interface PaginatedOrders {
  orders: OrderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BulkOrderResultItem {
  link: string;
  orderId: string | null;
  status: 'success' | 'error';
  error?: string;
}

export interface BulkOrderResult {
  results: BulkOrderResultItem[];
  totalCreated: number;
  totalFailed: number;
}

export interface ServiceRecord {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  type: string;
  pricePer1000: { toNumber(): number };
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  providerId: string | null;
  externalServiceId: string | null;
  refillDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderRecord {
  id: string;
  userId: string;
  serviceId: string;
  providerId: string | null;
  externalOrderId: string | null;
  link: string;
  quantity: number;
  price: { toNumber(): number };
  status: string;
  startCount: number | null;
  remains: number | null;
  isDripFeed: boolean;
  dripFeedRuns: number | null;
  dripFeedInterval: number | null;
  dripFeedRunsCompleted: number;
  dripFeedPausedAt: Date | null;
  refillEligibleUntil: Date | null;
  refillCount: number;
  couponId: string | null;
  discount: { toNumber(): number };
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface CreateOrderData {
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
  price: number;
  comments?: string | undefined;
  isDripFeed?: boolean | undefined;
  dripFeedRuns?: number | undefined;
  dripFeedInterval?: number | undefined;
  dripFeedRunsCompleted?: number | undefined;
  couponId?: string | null;
  discount?: number | undefined;
}

export interface UpdateOrderData {
  status: string;
  completedAt?: Date | null;
  startCount?: number | null;
  remains?: number | null;
  providerId?: string | null;
  externalOrderId?: string | null;
  refillEligibleUntil?: Date | null;
  dripFeedRunsCompleted?: number;
}

export interface CreateServiceData {
  name: string;
  description?: string | undefined;
  platform: string;
  type: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  providerId?: string;
  externalServiceId?: string;
}

export interface UpdateServiceData {
  name?: string | undefined;
  description?: string | undefined;
  platform?: string | undefined;
  type?: string | undefined;
  pricePer1000?: number | undefined;
  minQuantity?: number | undefined;
  maxQuantity?: number | undefined;
  isActive?: boolean | undefined;
  providerId?: string | undefined;
  externalServiceId?: string | undefined;
}
