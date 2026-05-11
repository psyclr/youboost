import { createSupportService } from '../support.service';
import { createFakeSupportRepository, silentLogger } from './fakes';
import type { SupportTicket, TicketMessage } from '../../../generated/prisma';

type TicketWithMessages = SupportTicket & {
  messages: Array<TicketMessage & { user: { id: string; username: string } }>;
};

function buildTicket(overrides: Partial<TicketWithMessages> = {}): TicketWithMessages {
  return {
    id: 'ticket-1',
    userId: 'user-1',
    subject: 'Help',
    description: 'Please help',
    status: 'OPEN',
    priority: 'MEDIUM',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    closedAt: null,
    messages: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(overrides as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as TicketWithMessages;
}

describe('Support Service', () => {
  describe('createTicket', () => {
    it('creates ticket and returns mapped response', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.createTicket('user-1', {
        subject: 'Help',
        description: 'Please help',
        priority: 'HIGH',
      });

      expect(result).toMatchObject({
        userId: 'user-1',
        subject: 'Help',
        description: 'Please help',
        priority: 'HIGH',
        status: 'OPEN',
      });
      expect(repo.calls.createTicket).toEqual([
        {
          userId: 'user-1',
          subject: 'Help',
          description: 'Please help',
          priority: 'HIGH',
        },
      ]);
    });
  });

  describe('getTicket', () => {
    it('returns ticket with mapped messages', async () => {
      const ticket = buildTicket({
        messages: [
          {
            id: 'msg-1',
            ticketId: 'ticket-1',
            userId: 'user-1',
            isAdmin: false,
            body: 'hi',
            createdAt: new Date('2026-01-02'),
            user: { id: 'user-1', username: 'alex' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
      });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.getTicket('ticket-1', 'user-1');

      expect(result.id).toBe('ticket-1');
      expect(result.messages).toEqual([
        {
          id: 'msg-1',
          userId: 'user-1',
          username: 'alex',
          isAdmin: false,
          body: 'hi',
          createdAt: new Date('2026-01-02'),
        },
      ]);
    });

    it('throws NotFoundError when ticket does not exist', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.getTicket('ticket-missing', 'user-1')).rejects.toMatchObject({
        code: 'TICKET_NOT_FOUND',
      });
    });

    it('throws NotFoundError when ticket belongs to different user', async () => {
      const ticket = buildTicket({ userId: 'user-other' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.getTicket('ticket-1', 'user-1')).rejects.toMatchObject({
        code: 'TICKET_NOT_FOUND',
      });
    });
  });

  describe('listTickets', () => {
    it('returns paginated tickets for user', async () => {
      const ticket = buildTicket();
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.listTickets('user-1', { page: 1, limit: 20 });

      expect(result.tickets).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(repo.calls.findTicketsByUserId).toEqual([
        { userId: 'user-1', filters: { status: undefined, page: 1, limit: 20 } },
      ]);
    });

    it('forwards status filter', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.listTickets('user-1', { page: 1, limit: 5, status: 'OPEN' });

      expect(result.pagination).toEqual({ page: 1, limit: 5, total: 0, totalPages: 0 });
      expect(repo.calls.findTicketsByUserId[0]?.filters.status).toBe('OPEN');
    });
  });

  describe('addMessage', () => {
    it('adds message when ticket is open', async () => {
      const ticket = buildTicket();
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.addMessage('ticket-1', 'user-1', 'please help');

      expect(result.id).toMatch(/^msg-/);
      expect(repo.calls.addMessage).toEqual([
        { ticketId: 'ticket-1', userId: 'user-1', isAdmin: false, body: 'please help' },
      ]);
    });

    it('throws NotFoundError when ticket missing', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.addMessage('ticket-x', 'user-1', 'hi')).rejects.toMatchObject({
        code: 'TICKET_NOT_FOUND',
      });
      expect(repo.calls.addMessage).toHaveLength(0);
    });

    it('throws ValidationError when ticket is closed', async () => {
      const ticket = buildTicket({ status: 'CLOSED' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.addMessage('ticket-1', 'user-1', 'hi')).rejects.toMatchObject({
        code: 'TICKET_CLOSED',
      });
      expect(repo.calls.addMessage).toHaveLength(0);
    });
  });

  describe('adminListTickets', () => {
    it('returns tickets enriched with user info', async () => {
      const ticketWithUser = {
        ...buildTicket(),
        user: { id: 'user-1', username: 'alex', email: 'alex@test.com' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      const repo = createFakeSupportRepository({ ticketsWithUser: [ticketWithUser] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.adminListTickets({ page: 1, limit: 20 });

      expect(result.tickets).toHaveLength(1);
      const first = result.tickets[0] as unknown as { username: string; email: string };
      expect(first.username).toBe('alex');
      expect(first.email).toBe('alex@test.com');
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('forwards status filter to repo', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await service.adminListTickets({ page: 1, limit: 10, status: 'IN_PROGRESS' });

      expect(repo.calls.findAllTickets).toEqual([{ status: 'IN_PROGRESS', page: 1, limit: 10 }]);
    });
  });

  describe('adminGetTicket', () => {
    it('returns ticket without user constraint', async () => {
      const ticket = buildTicket({ userId: 'some-other-user' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.adminGetTicket('ticket-1');

      expect(result.id).toBe('ticket-1');
      expect(repo.calls.findTicketById).toEqual([{ ticketId: 'ticket-1' }]);
    });

    it('throws NotFoundError when ticket missing', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.adminGetTicket('ticket-x')).rejects.toMatchObject({
        code: 'TICKET_NOT_FOUND',
      });
    });
  });

  describe('adminAddMessage', () => {
    it('transitions OPEN ticket to IN_PROGRESS on first admin reply', async () => {
      const ticket = buildTicket({ status: 'OPEN' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await service.adminAddMessage('ticket-1', 'admin-1', 'reply');

      expect(repo.calls.updateTicketStatus).toEqual([
        { ticketId: 'ticket-1', status: 'IN_PROGRESS' },
      ]);
      expect(repo.calls.addMessage).toEqual([
        { ticketId: 'ticket-1', userId: 'admin-1', isAdmin: true, body: 'reply' },
      ]);
    });

    it('does not transition when ticket already IN_PROGRESS', async () => {
      const ticket = buildTicket({ status: 'IN_PROGRESS' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await service.adminAddMessage('ticket-1', 'admin-1', 'reply');

      expect(repo.calls.updateTicketStatus).toHaveLength(0);
      expect(repo.calls.addMessage).toHaveLength(1);
    });

    it('throws NotFoundError when ticket missing', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.adminAddMessage('ticket-x', 'admin-1', 'reply')).rejects.toMatchObject({
        code: 'TICKET_NOT_FOUND',
      });
    });
  });

  describe('adminUpdateStatus', () => {
    it('sets closedAt when status is CLOSED', async () => {
      const ticket = buildTicket({ status: 'OPEN' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      const result = await service.adminUpdateStatus('ticket-1', 'CLOSED');

      expect(result.status).toBe('CLOSED');
      expect(repo.calls.updateTicketStatus).toHaveLength(1);
      const call = repo.calls.updateTicketStatus[0];
      expect(call?.status).toBe('CLOSED');
      expect(call?.closedAt).toBeInstanceOf(Date);
    });

    it('does not set closedAt for non-CLOSED statuses', async () => {
      const ticket = buildTicket({ status: 'OPEN' });
      const repo = createFakeSupportRepository({ tickets: [ticket] });
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await service.adminUpdateStatus('ticket-1', 'RESOLVED');

      const call = repo.calls.updateTicketStatus[0];
      expect(call?.status).toBe('RESOLVED');
      expect(call?.closedAt).toBeUndefined();
    });

    it('throws NotFoundError when ticket missing', async () => {
      const repo = createFakeSupportRepository();
      const service = createSupportService({ supportRepo: repo, logger: silentLogger });

      await expect(service.adminUpdateStatus('ticket-x', 'CLOSED')).rejects.toMatchObject({
        code: 'TICKET_NOT_FOUND',
      });
    });
  });
});
