import { createOutboxService } from '../outbox.service';
import type { OutboxRepository, CreateOutboxEventData, OutboxEventRow } from '../outbox.repository';
import type { Prisma } from '../../../generated/prisma';
import type { OutboxEvent } from '../events';

const silentLogger = {
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

describe('OutboxService', () => {
  it('emit forwards event fields to repository.createEvent and requires tx', async () => {
    const seen: { data?: CreateOutboxEventData; tx?: Prisma.TransactionClient } = {};
    const repo: Partial<OutboxRepository> = {
      async createEvent(data, tx): Promise<OutboxEventRow> {
        seen.data = data;
        seen.tx = tx;
        return {
          id: 'ev-1',
          aggregateType: data.aggregateType,
          aggregateId: data.aggregateId,
          eventType: data.eventType,
          payload: data.payload as Prisma.JsonValue,
          userId: data.userId,
          status: 'PENDING',
          attempts: 0,
          lastError: null,
          availableAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          createdAt: new Date(),
          publishedAt: null,
        };
      },
    };
    const service = createOutboxService({
      outboxRepo: repo as OutboxRepository,
      logger: silentLogger,
    });

    const event: OutboxEvent = {
      type: 'deposit.confirmed',
      aggregateType: 'deposit',
      aggregateId: 'dep-1',
      userId: 'user-1',
      payload: { depositId: 'dep-1', userId: 'user-1', amount: 25, provider: 'Stripe' },
    };
    const fakeTx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

    await service.emit(event, fakeTx);

    expect(seen.tx).toBe(fakeTx);
    expect(seen.data).toEqual({
      aggregateType: 'deposit',
      aggregateId: 'dep-1',
      eventType: 'deposit.confirmed',
      payload: event.payload,
      userId: 'user-1',
    });
  });
});
