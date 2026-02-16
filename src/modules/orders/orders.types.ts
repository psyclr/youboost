import { z } from 'zod/v4';

export const createOrderSchema = z.object({
  serviceId: z.string().uuid(),
  link: z.string().url(),
  quantity: z.number().int().min(1),
  comments: z.string().max(500).optional(),
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

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type OrderIdParam = z.infer<typeof orderIdSchema>;

export interface OrderResponse {
  orderId: string;
  serviceId: string;
  status: string;
  quantity: number;
  completed: number;
  price: number;
  createdAt: Date;
}

export interface OrderDetailed extends OrderResponse {
  link: string;
  startCount: number | null;
  remains: number | null;
  updatedAt: Date;
  comments: string | null;
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
  comments?: string;
}

export interface UpdateOrderData {
  status: string;
  completedAt?: Date | null;
  startCount?: number | null;
  remains?: number | null;
  providerId?: string | null;
  externalOrderId?: string | null;
}
