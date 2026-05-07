import { getPrisma } from '../../shared/database';
import type { PrismaClient, SupportTicket, TicketMessage } from '../../generated/prisma';

interface CreateTicketData {
  userId: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

interface TicketFilters {
  status?: string | undefined;
  page: number;
  limit: number;
}

export interface SupportRepository {
  createTicket(data: CreateTicketData): Promise<SupportTicket>;
  findTicketById(
    ticketId: string,
    userId?: string,
  ): Promise<
    | (SupportTicket & {
        messages: Array<
          TicketMessage & {
            user: { id: string; username: string };
          }
        >;
      })
    | null
  >;
  findTicketsByUserId(
    userId: string,
    filters: TicketFilters,
  ): Promise<{ tickets: SupportTicket[]; total: number }>;
  findAllTickets(filters: TicketFilters): Promise<{
    tickets: Array<SupportTicket & { user: { id: string; username: string; email: string } }>;
    total: number;
  }>;
  addMessage(params: {
    ticketId: string;
    userId: string;
    isAdmin: boolean;
    body: string;
  }): Promise<TicketMessage>;
  updateTicketStatus(ticketId: string, status: string, closedAt?: Date): Promise<SupportTicket>;
}

export function createSupportRepository(prisma: PrismaClient): SupportRepository {
  async function createTicket(data: CreateTicketData): Promise<SupportTicket> {
    return prisma.supportTicket.create({
      data: {
        userId: data.userId,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
      },
    });
  }

  async function findTicketById(
    ticketId: string,
    userId?: string,
  ): Promise<
    | (SupportTicket & {
        messages: Array<
          TicketMessage & {
            user: { id: string; username: string };
          }
        >;
      })
    | null
  > {
    const where: Record<string, unknown> = { id: ticketId };
    if (userId) {
      where.userId = userId;
    }

    return prisma.supportTicket.findFirst({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });
  }

  async function findTicketsByUserId(
    userId: string,
    filters: TicketFilters,
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    const where: Record<string, unknown> = { userId };
    if (filters.status) {
      where.status = filters.status;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { tickets, total };
  }

  async function findAllTickets(filters: TicketFilters): Promise<{
    tickets: Array<SupportTicket & { user: { id: string; username: string; email: string } }>;
    total: number;
  }> {
    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return { tickets, total };
  }

  async function addMessage(params: {
    ticketId: string;
    userId: string;
    isAdmin: boolean;
    body: string;
  }): Promise<TicketMessage> {
    return prisma.ticketMessage.create({
      data: {
        ticketId: params.ticketId,
        userId: params.userId,
        isAdmin: params.isAdmin,
        body: params.body,
      },
    });
  }

  async function updateTicketStatus(
    ticketId: string,
    status: string,
    closedAt?: Date,
  ): Promise<SupportTicket> {
    const data: Record<string, unknown> = { status };
    if (closedAt) {
      data.closedAt = closedAt;
    }
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });
  }

  return {
    createTicket,
    findTicketById,
    findTicketsByUserId,
    findAllTickets,
    addMessage,
    updateTicketStatus,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createTicket(data: CreateTicketData): Promise<SupportTicket> {
  return createSupportRepository(getPrisma()).createTicket(data);
}

export async function findTicketById(
  ticketId: string,
  userId?: string,
): Promise<
  | (SupportTicket & {
      messages: Array<
        TicketMessage & {
          user: { id: string; username: string };
        }
      >;
    })
  | null
> {
  return createSupportRepository(getPrisma()).findTicketById(ticketId, userId);
}

export async function findTicketsByUserId(
  userId: string,
  filters: TicketFilters,
): Promise<{ tickets: SupportTicket[]; total: number }> {
  return createSupportRepository(getPrisma()).findTicketsByUserId(userId, filters);
}

export async function findAllTickets(filters: TicketFilters): Promise<{
  tickets: Array<SupportTicket & { user: { id: string; username: string; email: string } }>;
  total: number;
}> {
  return createSupportRepository(getPrisma()).findAllTickets(filters);
}

export async function addMessage(params: {
  ticketId: string;
  userId: string;
  isAdmin: boolean;
  body: string;
}): Promise<TicketMessage> {
  return createSupportRepository(getPrisma()).addMessage(params);
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
  closedAt?: Date,
): Promise<SupportTicket> {
  return createSupportRepository(getPrisma()).updateTicketStatus(ticketId, status, closedAt);
}
