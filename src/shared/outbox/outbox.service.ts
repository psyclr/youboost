import type { Prisma } from '../../generated/prisma';
import type { Logger } from 'pino';
import type { OutboxEvent } from './events';
import type { OutboxPort } from './outbox.port';
import type { OutboxRepository } from './outbox.repository';

export interface OutboxServiceDeps {
  outboxRepo: OutboxRepository;
  logger: Logger;
}

export function createOutboxService(deps: OutboxServiceDeps): OutboxPort {
  const { outboxRepo, logger } = deps;

  async function emit(event: OutboxEvent, tx: Prisma.TransactionClient): Promise<void> {
    const row = await outboxRepo.createEvent(
      {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        userId: event.userId,
      },
      tx,
    );
    logger.debug(
      { eventId: row.id, eventType: event.type, aggregateId: event.aggregateId },
      'outbox event emitted',
    );
  }

  return { emit };
}
