import { getPrisma } from '../../shared/database';
import type { SupportTicket, TicketMessage } from '../../generated/prisma';

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

export async function createTicket(data: CreateTicketData): Promise<SupportTicket> {
  const prisma = getPrisma();
  return prisma.supportTicket.create({
    data: {
      userId: data.userId,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
    },
  });
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
  const prisma = getPrisma();
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

export async function findTicketsByUserId(
  userId: string,
  filters: TicketFilters,
): Promise<{ tickets: SupportTicket[]; total: number }> {
  const prisma = getPrisma();
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

export async function findAllTickets(filters: TicketFilters): Promise<{
  tickets: Array<SupportTicket & { user: { id: string; username: string; email: string } }>;
  total: number;
}> {
  const prisma = getPrisma();
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

export async function addMessage(params: {
  ticketId: string;
  userId: string;
  isAdmin: boolean;
  body: string;
}): Promise<TicketMessage> {
  const prisma = getPrisma();
  return prisma.ticketMessage.create({
    data: {
      ticketId: params.ticketId,
      userId: params.userId,
      isAdmin: params.isAdmin,
      body: params.body,
    },
  });
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
  closedAt?: Date,
): Promise<SupportTicket> {
  const prisma = getPrisma();
  const data: Record<string, unknown> = { status };
  if (closedAt) {
    data.closedAt = closedAt;
  }
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data,
  });
}
