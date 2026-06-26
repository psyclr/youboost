import { apiRequest, apiRequestVoid } from './client';
import { buildQuery } from './query';
import type {
  AdminDepositResponse,
  AdminServiceCreateInput,
  AdminServiceResponse,
  AdminServicePanel,
  AdminServiceUpdateInput,
  AdminUserDetailResponse,
  AdminOrderResponse,
  DashboardStats,
  Paginated,
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
}) =>
  apiRequest<PaginatedUsers>(
    `/admin/users${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      role: params?.role,
      status: params?.status,
    })}`,
  );

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
}) =>
  apiRequest<PaginatedAdminOrders>(
    `/admin/orders${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      status: params?.status,
      userId: params?.userId,
      isDripFeed: params?.isDripFeed,
    })}`,
  );

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

// Deposits
export const getAdminDeposits = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}) =>
  apiRequest<Paginated<'deposits', AdminDepositResponse>>(
    `/admin/deposits${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      status: params?.status,
      userId: params?.userId,
    })}`,
  );

export const adminConfirmDeposit = (depositId: string) =>
  apiRequest<AdminDepositResponse>(`/admin/deposits/${depositId}/confirm`, {
    method: 'POST',
  });

export const adminExpireDeposit = (depositId: string) =>
  apiRequest<AdminDepositResponse>(`/admin/deposits/${depositId}/expire`, {
    method: 'POST',
  });

// Services
export const getAdminServices = (params?: { page?: number; limit?: number }) =>
  apiRequest<Paginated<'services', AdminServiceResponse>>(
    `/admin/services${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
    })}`,
  );

export const createAdminService = (data: AdminServiceCreateInput) =>
  apiRequest<AdminServiceResponse>('/admin/services', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAdminService = (serviceId: string, data: AdminServiceUpdateInput) =>
  apiRequest<AdminServiceResponse>(`/admin/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

// Service panels (failover providers attached to a service)
export const getServicePanels = (serviceId: string) =>
  apiRequest<{ panels: AdminServicePanel[] }>(`/admin/services/${serviceId}/panels`).then(
    (res) => res.panels,
  );

export const addServicePanel = (
  serviceId: string,
  data: { providerId: string; externalServiceId: string },
) =>
  apiRequest<AdminServicePanel>(`/admin/services/${serviceId}/panels`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateServicePanel = (
  mappingId: string,
  data: { externalServiceId?: string; isActive?: boolean },
) =>
  apiRequest<AdminServicePanel>(`/admin/services/panels/${mappingId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteServicePanel = (mappingId: string) =>
  apiRequestVoid(`/admin/services/panels/${mappingId}`, { method: 'DELETE' });

// Providers
export const getProviders = (params?: { page?: number; limit?: number; isActive?: boolean }) =>
  apiRequest<PaginatedProviders>(
    `/providers${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      isActive: params?.isActive,
    })}`,
  );

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
  apiRequestVoid(`/providers/${id}`, { method: 'DELETE' });

export const getProviderServices = (id: string) =>
  apiRequest<{ services: ProviderServiceItem[] }>(`/providers/${id}/services`);

export const getProviderBalance = (id: string) =>
  apiRequest<ProviderBalanceInfo>(`/providers/${id}/balance`);
