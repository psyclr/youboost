import { apiRequest } from './client';
import type {
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
  return apiRequest<PaginatedOrders>(`/orders${qs ? `?${qs}` : ''}`);
};

export const getOrder = (orderId: string) => apiRequest<OrderDetailed>(`/orders/${orderId}`);

export const cancelOrder = (orderId: string) =>
  apiRequest<CancelOrderResponse>(`/orders/${orderId}/cancel`, {
    method: 'POST',
  });
