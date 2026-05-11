import { createSupportRepository } from '../support.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    ticketCreate: jest.Mock;
    ticketFindFirst: jest.Mock;
    ticketFindMany: jest.Mock;
    ticketCount: jest.Mock;
    ticketUpdate: jest.Mock;
    messageCreate: jest.Mock;
  };
} {
  const ticketCreate = jest.fn();
  const ticketFindFirst = jest.fn();
  const ticketFindMany = jest.fn();
  const ticketCount = jest.fn();
  const ticketUpdate = jest.fn();
  const messageCreate = jest.fn();
  const prisma = {
    supportTicket: {
      create: ticketCreate,
      findFirst: ticketFindFirst,
      findMany: ticketFindMany,
      count: ticketCount,
      update: ticketUpdate,
    },
    ticketMessage: { create: messageCreate },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return {
    prisma,
    mocks: {
      ticketCreate,
      ticketFindFirst,
      ticketFindMany,
      ticketCount,
      ticketUpdate,
      messageCreate,
    },
  };
}

const mockTicket = {
  id: 'ticket-1',
  userId: 'user-1',
  subject: 'Help',
  description: 'Need help please',
  status: 'OPEN',
  priority: 'MEDIUM',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  closedAt: null,
};

describe('Support Repository', () => {
  describe('createTicket', () => {
    it('calls prisma.supportTicket.create with all ticket fields', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketCreate.mockResolvedValue(mockTicket);
      const repo = createSupportRepository(prisma);

      const result = await repo.createTicket({
        userId: 'user-1',
        subject: 'Help',
        description: 'Need help please',
        priority: 'HIGH',
      });

      expect(result).toEqual(mockTicket);
      expect(mocks.ticketCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          subject: 'Help',
          description: 'Need help please',
          priority: 'HIGH',
        },
      });
    });
  });

  describe('findTicketById', () => {
    it('finds ticket by id only when userId not supplied', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketFindFirst.mockResolvedValue({ ...mockTicket, messages: [] });
      const repo = createSupportRepository(prisma);

      const result = await repo.findTicketById('ticket-1');

      expect(result).toEqual({ ...mockTicket, messages: [] });
      expect(mocks.ticketFindFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, username: true } },
            },
          },
        },
      });
    });

    it('adds userId constraint when supplied', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketFindFirst.mockResolvedValue({ ...mockTicket, messages: [] });
      const repo = createSupportRepository(prisma);

      await repo.findTicketById('ticket-1', 'user-1');

      expect(mocks.ticketFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-1', userId: 'user-1' },
        }),
      );
    });

    it('returns null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketFindFirst.mockResolvedValue(null);
      const repo = createSupportRepository(prisma);

      const result = await repo.findTicketById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findTicketsByUserId', () => {
    it('returns tickets and total with pagination', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketFindMany.mockResolvedValue([mockTicket]);
      mocks.ticketCount.mockResolvedValue(1);
      const repo = createSupportRepository(prisma);

      const result = await repo.findTicketsByUserId('user-1', { page: 1, limit: 20 });

      expect(result).toEqual({ tickets: [mockTicket], total: 1 });
      expect(mocks.ticketFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mocks.ticketCount).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('adds status filter when provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketFindMany.mockResolvedValue([]);
      mocks.ticketCount.mockResolvedValue(0);
      const repo = createSupportRepository(prisma);

      await repo.findTicketsByUserId('user-1', { page: 2, limit: 10, status: 'OPEN' });

      expect(mocks.ticketFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'OPEN' },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mocks.ticketCount).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'OPEN' },
      });
    });
  });

  describe('findAllTickets', () => {
    it('returns tickets with user relation and total', async () => {
      const { prisma, mocks } = createFakePrisma();
      const ticketWithUser = {
        ...mockTicket,
        user: { id: 'user-1', username: 'alex', email: 'alex@test.com' },
      };
      mocks.ticketFindMany.mockResolvedValue([ticketWithUser]);
      mocks.ticketCount.mockResolvedValue(1);
      const repo = createSupportRepository(prisma);

      const result = await repo.findAllTickets({ page: 1, limit: 20 });

      expect(result).toEqual({ tickets: [ticketWithUser], total: 1 });
      expect(mocks.ticketFindMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      });
      expect(mocks.ticketCount).toHaveBeenCalledWith({ where: {} });
    });

    it('applies status filter when provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketFindMany.mockResolvedValue([]);
      mocks.ticketCount.mockResolvedValue(0);
      const repo = createSupportRepository(prisma);

      await repo.findAllTickets({ page: 1, limit: 20, status: 'CLOSED' });

      expect(mocks.ticketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'CLOSED' } }),
      );
      expect(mocks.ticketCount).toHaveBeenCalledWith({ where: { status: 'CLOSED' } });
    });
  });

  describe('addMessage', () => {
    it('calls prisma.ticketMessage.create with message fields', async () => {
      const { prisma, mocks } = createFakePrisma();
      const mockMessage = {
        id: 'msg-1',
        ticketId: 'ticket-1',
        userId: 'user-1',
        isAdmin: false,
        body: 'hello',
        createdAt: new Date('2026-01-02'),
      };
      mocks.messageCreate.mockResolvedValue(mockMessage);
      const repo = createSupportRepository(prisma);

      const result = await repo.addMessage({
        ticketId: 'ticket-1',
        userId: 'user-1',
        isAdmin: false,
        body: 'hello',
      });

      expect(result).toEqual(mockMessage);
      expect(mocks.messageCreate).toHaveBeenCalledWith({
        data: {
          ticketId: 'ticket-1',
          userId: 'user-1',
          isAdmin: false,
          body: 'hello',
        },
      });
    });
  });

  describe('updateTicketStatus', () => {
    it('updates status without closedAt', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.ticketUpdate.mockResolvedValue({ ...mockTicket, status: 'IN_PROGRESS' });
      const repo = createSupportRepository(prisma);

      const result = await repo.updateTicketStatus('ticket-1', 'IN_PROGRESS');

      expect(result.status).toBe('IN_PROGRESS');
      expect(mocks.ticketUpdate).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('includes closedAt when provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      const closedAt = new Date('2026-01-05');
      mocks.ticketUpdate.mockResolvedValue({ ...mockTicket, status: 'CLOSED', closedAt });
      const repo = createSupportRepository(prisma);

      await repo.updateTicketStatus('ticket-1', 'CLOSED', closedAt);

      expect(mocks.ticketUpdate).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: 'CLOSED', closedAt },
      });
    });
  });
});
