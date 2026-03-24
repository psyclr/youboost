import { apiRequest } from './client';
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
  apiRequest<OrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getOrders = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  serviceId?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/orders${query}`;
  return apiRequest<PaginatedOrders>(url);
};

export const getOrder = (orderId: string) => apiRequest<OrderDetailed>(`/orders/${orderId}`);

export const cancelOrder = (orderId: string) =>
  apiRequest<CancelOrderResponse>(`/orders/${orderId}/cancel`, {
    method: 'POST',
  });

export const refillOrder = (orderId: string) =>
  apiRequest<OrderDetailed>(`/orders/${orderId}/refill`, {
    method: 'POST',
  });

export const createBulkOrders = (data: BulkOrderInput) =>
  apiRequest<BulkOrderResult>('/orders/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
