import { apiRequest } from './client';

export interface TrackingLinkWithStats {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  registrations: number;
  lastRegistration: string | null;
}

export interface CreateTrackingLinkInput {
  code: string;
  name: string;
}

export const getTrackingLinks = () => apiRequest<TrackingLinkWithStats[]>('/admin/tracking-links');

export const createTrackingLink = (data: CreateTrackingLinkInput) =>
  apiRequest<TrackingLinkWithStats>('/admin/tracking-links', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteTrackingLink = (id: string) =>
  apiRequest<void>(`/admin/tracking-links/${id}`, { method: 'DELETE' });
