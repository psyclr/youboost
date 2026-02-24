import { apiRequest } from './client';
import type {
  AdminServiceResponse,
  AdminUserDetailResponse,
  AdminOrderResponse,
  DashboardStats,
  PaginatedAdminOrders,
  PaginatedUsers,
} from './types';

// Dashboard
export const getDashboardStats = () => apiRequest<DashboardStats>('/admin/dashboard');

// Users
export const getAdminUsers = (params?: {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.role) searchParams.set('role', params.role);
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return apiRequest<PaginatedUsers>(`/admin/users${qs ? `?${qs}` : ''}`);
};

export const getAdminUser = (userId: string) =>
  apiRequest<AdminUserDetailResponse>(`/admin/users/${userId}`);

export const updateAdminUser = (userId: string, data: { role?: string; status?: string }) =>
  apiRequest<AdminUserDetailResponse>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const adjustBalance = (userId: string, data: { amount: number; reason: string }) =>
  apiRequest<{ message: string }>(`/admin/users/${userId}/balance`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Orders
export const getAdminOrders = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.userId) searchParams.set('userId', params.userId);
  const qs = searchParams.toString();
  return apiRequest<PaginatedAdminOrders>(`/admin/orders${qs ? `?${qs}` : ''}`);
};

export const getAdminOrder = (orderId: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}`);

export const forceOrderStatus = (orderId: string, status: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const refundOrder = (orderId: string) =>
  apiRequest<{ message: string }>(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
  });

// Services
export const getAdminServices = (params?: { page?: number; limit?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  return apiRequest<{
    services: AdminServiceResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/admin/services${qs ? `?${qs}` : ''}`);
};

export const createAdminService = (data: {
  name: string;
  description?: string;
  platform: string;
  type: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
}) =>
  apiRequest<AdminServiceResponse>('/admin/services', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAdminService = (serviceId: string, data: Record<string, unknown>) =>
  apiRequest<AdminServiceResponse>(`/admin/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
