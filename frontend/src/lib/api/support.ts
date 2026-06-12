import { apiRequest } from './client';
import { buildQuery } from './query';
import type { Paginated } from './types';

export interface TicketMessageResponse {
  id: string;
  userId: string;
  username: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface TicketResponse {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  username?: string;
  email?: string;
}

export interface TicketDetailResponse extends TicketResponse {
  messages: TicketMessageResponse[];
}

export type PaginatedTickets = Paginated<'tickets', TicketResponse>;

// User functions

export const createTicket = (data: { subject: string; description: string; priority?: string }) =>
  apiRequest<TicketResponse>('/support/tickets', { method: 'POST', body: JSON.stringify(data) });

export const listTickets = (params?: { page?: number; status?: string }) =>
  apiRequest<PaginatedTickets>(
    `/support/tickets${buildQuery({
      page: params?.page || undefined,
      status: params?.status,
    })}`,
  );

export const getTicket = (ticketId: string) =>
  apiRequest<TicketDetailResponse>(`/support/tickets/${ticketId}`);

export const addTicketMessage = (ticketId: string, body: string) =>
  apiRequest<{ id: string }>(`/support/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

// Admin functions

export const adminListTickets = (params?: { page?: number; status?: string }) =>
  apiRequest<PaginatedTickets>(
    `/admin/support/tickets${buildQuery({
      page: params?.page || undefined,
      status: params?.status,
    })}`,
  );

export const adminGetTicket = (ticketId: string) =>
  apiRequest<TicketDetailResponse>(`/admin/support/tickets/${ticketId}`);

export const adminAddMessage = (ticketId: string, body: string) =>
  apiRequest<{ id: string }>(`/admin/support/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

export const adminUpdateTicketStatus = (ticketId: string, status: string) =>
  apiRequest<TicketResponse>(`/admin/support/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
