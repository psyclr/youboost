import { apiRequest } from './client';
import type {
  AdminLandingListItem,
  LandingAnalyticsResponse,
  LandingCreateInput,
  LandingResponse,
  LandingStatus,
  LandingUpdateInput,
  PaginatedLandings,
} from './types';

export const getAdminLandings = (params?: {
  page?: number;
  limit?: number;
  status?: LandingStatus;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  return apiRequest<PaginatedLandings>(`/admin/landings${query}`);
};

export const getAdminLanding = (landingId: string) =>
  apiRequest<LandingResponse>(`/admin/landings/${landingId}`);

export const createAdminLanding = (data: LandingCreateInput) =>
  apiRequest<LandingResponse>('/admin/landings', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAdminLanding = (landingId: string, data: LandingUpdateInput) =>
  apiRequest<LandingResponse>(`/admin/landings/${landingId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const publishAdminLanding = (landingId: string) =>
  apiRequest<LandingResponse>(`/admin/landings/${landingId}/publish`, {
    method: 'POST',
  });

export const unpublishAdminLanding = (landingId: string) =>
  apiRequest<LandingResponse>(`/admin/landings/${landingId}/unpublish`, {
    method: 'POST',
  });

export const archiveAdminLanding = (landingId: string) =>
  apiRequest<LandingResponse>(`/admin/landings/${landingId}/archive`, {
    method: 'POST',
  });

export const getAdminLandingAnalytics = (landingId: string) =>
  apiRequest<LandingAnalyticsResponse>(`/admin/landings/${landingId}/analytics`);

export type { AdminLandingListItem };
