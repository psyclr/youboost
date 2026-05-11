import type { SupportRepository } from '../support.repository';
import type { SupportTicket, TicketMessage } from '../../../generated/prisma';

type TicketWithRelations = SupportTicket & {
  messages: Array<
    TicketMessage & {
      user: { id: string; username: string };
    }
  >;
};

type TicketWithUser = SupportTicket & {
  user: { id: string; username: string; email: string };
};

export interface FakeSupportRepoSeed {
  tickets?: TicketWithRelations[];
  ticketsWithUser?: TicketWithUser[];
}

export interface FakeSupportRepoCalls {
  createTicket: Array<{
    userId: string;
    subject: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }>;
  findTicketById: Array<{ ticketId: string; userId?: string }>;
  findTicketsByUserId: Array<{
    userId: string;
    filters: { status?: string | undefined; page: number; limit: number };
  }>;
  findAllTickets: Array<{ status?: string | undefined; page: number; limit: number }>;
  addMessage: Array<{
    ticketId: string;
    userId: string;
    isAdmin: boolean;
    body: string;
  }>;
  updateTicketStatus: Array<{ ticketId: string; status: string; closedAt?: Date }>;
}

export function createFakeSupportRepository(
  seed: FakeSupportRepoSeed = {},
): SupportRepository & { calls: FakeSupportRepoCalls } {
  const byId = new Map<string, TicketWithRelations>((seed.tickets ?? []).map((t) => [t.id, t]));
  const withUser = new Map<string, TicketWithUser>(
    (seed.ticketsWithUser ?? []).map((t) => [t.id, t]),
  );
  const calls: FakeSupportRepoCalls = {
    createTicket: [],
    findTicketById: [],
    findTicketsByUserId: [],
    findAllTickets: [],
    addMessage: [],
    updateTicketStatus: [],
  };

  let ticketCounter = byId.size + 1;
  let messageCounter = 1;

  return {
    async createTicket(data) {
      calls.createTicket.push(data);
      const ticket = {
        id: `ticket-${ticketCounter++}`,
        userId: data.userId,
        subject: data.subject,
        description: data.description,
        status: 'OPEN',
        priority: data.priority,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        closedAt: null,
        messages: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as TicketWithRelations;
      byId.set(ticket.id, ticket);
      return ticket;
    },
    async findTicketById(ticketId, userId) {
      calls.findTicketById.push({ ticketId, ...(userId !== undefined ? { userId } : {}) });
      const ticket = byId.get(ticketId);
      if (!ticket) return null;
      if (userId && ticket.userId !== userId) return null;
      return ticket;
    },
    async findTicketsByUserId(userId, filters) {
      calls.findTicketsByUserId.push({ userId, filters });
      const filtered = Array.from(byId.values()).filter((t) => {
        if (t.userId !== userId) return false;
        if (filters.status && t.status !== filters.status) return false;
        return true;
      });
      const start = (filters.page - 1) * filters.limit;
      const tickets = filtered.slice(start, start + filters.limit);
      return { tickets, total: filtered.length };
    },
    async findAllTickets(filters) {
      calls.findAllTickets.push(filters);
      const filtered = Array.from(withUser.values()).filter((t) => {
        if (filters.status && t.status !== filters.status) return false;
        return true;
      });
      const start = (filters.page - 1) * filters.limit;
      const tickets = filtered.slice(start, start + filters.limit);
      return { tickets, total: filtered.length };
    },
    async addMessage(params) {
      calls.addMessage.push(params);
      const message = {
        id: `msg-${messageCounter++}`,
        ticketId: params.ticketId,
        userId: params.userId,
        isAdmin: params.isAdmin,
        body: params.body,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as TicketMessage;
      return message;
    },
    async updateTicketStatus(ticketId, status, closedAt) {
      calls.updateTicketStatus.push({
        ticketId,
        status,
        ...(closedAt !== undefined ? { closedAt } : {}),
      });
      const existing = byId.get(ticketId);
      const updated = {
        id: ticketId,
        userId: existing?.userId ?? 'user-x',
        subject: existing?.subject ?? 'sub',
        description: existing?.description ?? 'desc',
        status,
        priority: existing?.priority ?? 'MEDIUM',
        createdAt: existing?.createdAt ?? new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-03T00:00:00Z'),
        closedAt: closedAt ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as SupportTicket;
      return updated;
    },
    calls,
  };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
