import type { Logger } from 'pino';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { SupportRepository } from './support.repository';
import type {
  CreateTicketInput,
  TicketQuery,
  TicketResponse,
  TicketDetailResponse,
  TicketMessageResponse,
  PaginatedTickets,
} from './support.types';

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

export interface SupportService {
  createTicket(userId: string, input: CreateTicketInput): Promise<TicketResponse>;
  getTicket(ticketId: string, userId: string): Promise<TicketDetailResponse>;
  listTickets(userId: string, query: TicketQuery): Promise<PaginatedTickets>;
  addMessage(ticketId: string, userId: string, body: string): Promise<{ id: string }>;
  adminListTickets(query: TicketQuery): Promise<PaginatedTickets>;
  adminGetTicket(ticketId: string): Promise<TicketDetailResponse>;
  adminAddMessage(ticketId: string, adminUserId: string, body: string): Promise<{ id: string }>;
  adminUpdateStatus(ticketId: string, status: string): Promise<TicketResponse>;
}

export interface SupportServiceDeps {
  supportRepo: SupportRepository;
  logger: Logger;
}

export function createSupportService(deps: SupportServiceDeps): SupportService {
  const { supportRepo, logger } = deps;

  // ---- User operations ----

  async function createTicket(userId: string, input: CreateTicketInput): Promise<TicketResponse> {
    const ticket = await supportRepo.createTicket({
      userId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
    });

    logger.info({ userId, ticketId: ticket.id }, 'Ticket created');
    return mapTicketToResponse(ticket);
  }

  async function getTicket(ticketId: string, userId: string): Promise<TicketDetailResponse> {
    const ticket = await supportRepo.findTicketById(ticketId, userId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    return {
      ...mapTicketToResponse(ticket),
      messages: mapMessages(ticket.messages),
    };
  }

  async function listTickets(userId: string, query: TicketQuery): Promise<PaginatedTickets> {
    const { tickets, total } = await supportRepo.findTicketsByUserId(userId, {
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

  async function addMessage(
    ticketId: string,
    userId: string,
    body: string,
  ): Promise<{ id: string }> {
    const ticket = await supportRepo.findTicketById(ticketId, userId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }
    if (ticket.status === 'CLOSED') {
      throw new ValidationError('Cannot add message to a closed ticket', 'TICKET_CLOSED');
    }

    const message = await supportRepo.addMessage({ ticketId, userId, isAdmin: false, body });
    logger.info({ userId, ticketId, messageId: message.id }, 'User message added');
    return { id: message.id };
  }

  // ---- Admin operations ----

  async function adminListTickets(query: TicketQuery): Promise<PaginatedTickets> {
    const { tickets, total } = await supportRepo.findAllTickets({
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

  async function adminGetTicket(ticketId: string): Promise<TicketDetailResponse> {
    const ticket = await supportRepo.findTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    return {
      ...mapTicketToResponse(ticket),
      messages: mapMessages(ticket.messages),
    };
  }

  async function adminAddMessage(
    ticketId: string,
    adminUserId: string,
    body: string,
  ): Promise<{ id: string }> {
    const ticket = await supportRepo.findTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    if (ticket.status === 'OPEN') {
      await supportRepo.updateTicketStatus(ticketId, 'IN_PROGRESS');
    }

    const message = await supportRepo.addMessage({
      ticketId,
      userId: adminUserId,
      isAdmin: true,
      body,
    });
    logger.info({ adminUserId, ticketId, messageId: message.id }, 'Admin message added');
    return { id: message.id };
  }

  async function adminUpdateStatus(ticketId: string, status: string): Promise<TicketResponse> {
    const ticket = await supportRepo.findTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
    }

    const closedAt = status === 'CLOSED' ? new Date() : undefined;
    const updated = await supportRepo.updateTicketStatus(ticketId, status, closedAt);

    logger.info({ ticketId, status }, 'Ticket status updated');
    return mapTicketToResponse(updated);
  }

  return {
    createTicket,
    getTicket,
    listTickets,
    addMessage,
    adminListTickets,
    adminGetTicket,
    adminAddMessage,
    adminUpdateStatus,
  };
}
