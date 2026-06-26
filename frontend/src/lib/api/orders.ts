import { apiRequest, apiRequestValidated } from './client';
import { buildQuery } from './query';
import { orderDetailedSchema, orderResponseSchema } from './schemas';
import type {
  BulkOrderInput,
  BulkOrderResult,
  CancelOrderResponse,
  CreateOrderInput,
  OrderDetailed,
  OrderResponse,
  PaginatedOrders,
} from './types';

export const createOrder = (data: CreateOrderInput) =>
  apiRequestValidated<OrderResponse>('/orders', orderResponseSchema, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getOrders = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  serviceId?: string;
}) =>
  apiRequest<PaginatedOrders>(
    `/orders${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      status: params?.status,
      serviceId: params?.serviceId,
    })}`,
  );

export const getOrder = (orderId: string) =>
  apiRequestValidated<OrderDetailed>(`/orders/${orderId}`, orderDetailedSchema);

export const cancelOrder = (orderId: string) =>
  apiRequest<CancelOrderResponse>(`/orders/${orderId}/cancel`, {
    method: 'POST',
  });

export const refillOrder = (orderId: string) =>
  apiRequestValidated<OrderDetailed>(`/orders/${orderId}/refill`, orderDetailedSchema, {
    method: 'POST',
  });

export const createBulkOrders = (data: BulkOrderInput) =>
  apiRequest<BulkOrderResult>('/orders/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
