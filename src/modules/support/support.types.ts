import { z } from 'zod/v4';

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(255),
  description: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const ticketMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const ticketQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});

export const ticketIdSchema = z.object({
  ticketId: z.uuid(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
export type TicketQuery = z.infer<typeof ticketQuerySchema>;
export type TicketIdParam = z.infer<typeof ticketIdSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

export interface TicketMessageResponse {
  id: string;
  userId: string;
  username: string;
  isAdmin: boolean;
  body: string;
  createdAt: Date;
}

export interface TicketResponse {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
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
