import type { Prisma } from '../../generated/prisma';
import type { OutboxEvent } from './events';

/**
 * Outbox emit contract. The `tx` parameter is required — this is the
 * point of the outbox: event creation must be atomic with the state
 * change it describes. Call sites wrap state change + emit inside
 * `prisma.$transaction(async (tx) => { ...; await outbox.emit(event, tx); })`.
 *
 * The worker picks up PENDING rows and dispatches them to handlers.
 * Until dispatch, an emitted event has no side effect outside the DB.
 */
export interface OutboxPort {
  emit(event: OutboxEvent, tx: Prisma.TransactionClient): Promise<void>;
}
