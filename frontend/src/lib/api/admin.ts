import { apiRequest } from './client';
import type {
  AdminServiceResponse,
  AdminUserDetailResponse,
  AdminOrderResponse,
  DashboardStats,
  PaginatedAdminOrders,
  PaginatedUsers,
  ProviderResponse,
  ProviderDetailResponse,
  PaginatedProviders,
  ProviderServiceItem,
  ProviderBalanceInfo,
} from './types';

// Dashboard
export const getDashboardStats = () => apiRequest<DashboardStats>('/admin/dashboard/stats');

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
  const query = qs ? `?${qs}` : '';
  const url = `/admin/users${query}`;
  return apiRequest<PaginatedUsers>(url);
};

export const getAdminUser = (userId: string) =>
  apiRequest<AdminUserDetailResponse>(`/admin/users/${userId}`);

export const updateAdminUser = (userId: string, data: { role?: string; status?: string }) =>
  apiRequest<AdminUserDetailResponse>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const adjustBalance = (userId: string, data: { amount: number; reason: string }) =>
  apiRequest<{ success: boolean }>(`/admin/users/${userId}/balance/adjust`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Orders
export const getAdminOrders = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  isDripFeed?: boolean;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.isDripFeed !== undefined) searchParams.set('isDripFeed', String(params.isDripFeed));
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/admin/orders${query}`;
  return apiRequest<PaginatedAdminOrders>(url);
};

export const getAdminOrder = (orderId: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}`);

export const forceOrderStatus = (orderId: string, status: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const refundOrder = (orderId: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
  });

export const pauseDripFeed = (orderId: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}/pause-drip-feed`, {
    method: 'POST',
  });

export const resumeDripFeed = (orderId: string) =>
  apiRequest<AdminOrderResponse>(`/admin/orders/${orderId}/resume-drip-feed`, {
    method: 'POST',
  });

// Services
export const getAdminServices = (params?: { page?: number; limit?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/admin/services${query}`;
  return apiRequest<{
    services: AdminServiceResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(url);
};

export const createAdminService = (data: {
  name: string;
  description?: string;
  platform: string;
  type: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  providerId: string;
  externalServiceId: string;
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

// Providers
export const getProviders = (params?: { page?: number; limit?: number; isActive?: boolean }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/providers${query}`;
  return apiRequest<PaginatedProviders>(url);
};

export const getProvider = (id: string) => apiRequest<ProviderDetailResponse>(`/providers/${id}`);

export const createProvider = (data: {
  name: string;
  apiEndpoint: string;
  apiKey: string;
  priority?: number;
}) =>
  apiRequest<ProviderResponse>('/providers', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateProvider = (
  id: string,
  data: {
    name?: string;
    apiEndpoint?: string;
    apiKey?: string;
    priority?: number;
    isActive?: boolean;
  },
) =>
  apiRequest<ProviderResponse>(`/providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deactivateProvider = (id: string) =>
  apiRequest<void>(`/providers/${id}`, { method: 'DELETE' });

export const getProviderServices = (id: string) =>
  apiRequest<{ services: ProviderServiceItem[] }>(`/providers/${id}/services`);

export const getProviderBalance = (id: string) =>
  apiRequest<ProviderBalanceInfo>(`/providers/${id}/balance`);
