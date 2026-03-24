import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as repo from './support.repository';
import type {
  CreateTicketInput,
  TicketQuery,
  TicketResponse,
  TicketDetailResponse,
  TicketMessageResponse,
  PaginatedTickets,
} from './support.types';

const log = createServiceLogger('support');

function mapTicketToResponse(ticket: {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}): TicketResponse {
  return {
    id: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt,
  };
}

function mapMessages(
  messages: {
    id: string;
    userId: string;
    isAdmin: boolean;
    body: string;
    createdAt: Date;
    user: { id: string; username: string };
  }[],
): TicketMessageResponse[] {
  return messages.map((m) => ({
    id: m.id,
    userId: m.userId,
    username: m.user.username,
    isAdmin: m.isAdmin,
    body: m.body,
    createdAt: m.createdAt,
  }));
}

// ---- User operations ----

export async function createTicket(
  userId: string,
  input: CreateTicketInput,
): Promise<TicketResponse> {
  const ticket = await repo.createTicket({
    userId,
    subject: input.subject,
    description: input.description,
    priority: input.priority,
  });

  log.info({ userId, ticketId: ticket.id }, 'Ticket created');
  return mapTicketToResponse(ticket);
}

export async function getTicket(ticketId: string, userId: string): Promise<TicketDetailResponse> {
  const ticket = await repo.findTicketById(ticketId, userId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
  }

  return {
    ...mapTicketToResponse(ticket),
    messages: mapMessages(ticket.messages),
  };
}

export async function listTickets(userId: string, query: TicketQuery): Promise<PaginatedTickets> {
  const { tickets, total } = await repo.findTicketsByUserId(userId, {
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

  return {
    tickets: tickets.map(mapTicketToResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function addMessage(
  ticketId: string,
  userId: string,
  body: string,
): Promise<{ id: string }> {
  const ticket = await repo.findTicketById(ticketId, userId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
  }
  if (ticket.status === 'CLOSED') {
    throw new ValidationError('Cannot add message to a closed ticket', 'TICKET_CLOSED');
  }

  const message = await repo.addMessage({ ticketId, userId, isAdmin: false, body });
  log.info({ userId, ticketId, messageId: message.id }, 'User message added');
  return { id: message.id };
}

// ---- Admin operations ----

export async function adminListTickets(query: TicketQuery): Promise<PaginatedTickets> {
  const { tickets, total } = await repo.findAllTickets({
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

  const mapped = tickets.map((t) => ({
    ...mapTicketToResponse(t),
    username: (t as unknown as { user: { username: string } }).user?.username,
    email: (t as unknown as { user: { email: string } }).user?.email,
  }));

  return {
    tickets: mapped,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function adminGetTicket(ticketId: string): Promise<TicketDetailResponse> {
  const ticket = await repo.findTicketById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
  }

  return {
    ...mapTicketToResponse(ticket),
    messages: mapMessages(ticket.messages),
  };
}

export async function adminAddMessage(
  ticketId: string,
  adminUserId: string,
  body: string,
): Promise<{ id: string }> {
  const ticket = await repo.findTicketById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
  }

  if (ticket.status === 'OPEN') {
    await repo.updateTicketStatus(ticketId, 'IN_PROGRESS');
  }

  const message = await repo.addMessage({ ticketId, userId: adminUserId, isAdmin: true, body });
  log.info({ adminUserId, ticketId, messageId: message.id }, 'Admin message added');
  return { id: message.id };
}

export async function adminUpdateStatus(ticketId: string, status: string): Promise<TicketResponse> {
  const ticket = await repo.findTicketById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
  }

  const closedAt = status === 'CLOSED' ? new Date() : undefined;
  const updated = await repo.updateTicketStatus(ticketId, status, closedAt);

  log.info({ ticketId, status }, 'Ticket status updated');
  return mapTicketToResponse(updated);
}
