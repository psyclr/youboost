import { apiRequest } from './client';

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

export interface PaginatedTickets {
  tickets: TicketResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User functions

export const createTicket = (data: { subject: string; description: string; priority?: string }) =>
  apiRequest<TicketResponse>('/support/tickets', { method: 'POST', body: JSON.stringify(data) });

export const listTickets = (params?: { page?: number; status?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return apiRequest<PaginatedTickets>(`/support/tickets${qs ? `?${qs}` : ''}`);
};

export const getTicket = (ticketId: string) =>
  apiRequest<TicketDetailResponse>(`/support/tickets/${ticketId}`);

export const addTicketMessage = (ticketId: string, body: string) =>
  apiRequest<{ id: string }>(`/support/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

// Admin functions

export const adminListTickets = (params?: { page?: number; status?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return apiRequest<PaginatedTickets>(`/admin/support/tickets${qs ? `?${qs}` : ''}`);
};

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
