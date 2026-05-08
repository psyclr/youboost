import type { Logger } from 'pino';
import type { Clock } from '../utils/clock';
import type { OutboxEvent, OutboxEventType } from './events';
import type { HandlerRegistry } from './handlers';
import type { OutboxRepository, OutboxEventRow } from './outbox.repository';

export interface OutboxWorkerConfig {
  workerId: string;
  pollIntervalMs: number;
  batchSize: number;
  lockDurationMs: number;
  maxAttempts: number;
  /**
   * Backoff: availableAt = now + baseBackoffMs * 2^(attempts - 1),
   * capped at maxBackoffMs.
   */
  baseBackoffMs: number;
  maxBackoffMs: number;
}

export const DEFAULT_OUTBOX_WORKER_CONFIG: OutboxWorkerConfig = {
  workerId: 'outbox-worker',
  pollIntervalMs: 2_000,
  batchSize: 50,
  lockDurationMs: 60_000,
  maxAttempts: 10,
  baseBackoffMs: 5_000,
  maxBackoffMs: 300_000,
};

export interface OutboxWorkerDeps {
  outboxRepo: OutboxRepository;
  handlers: HandlerRegistry;
  clock: Clock;
  logger: Logger;
  config?: Partial<OutboxWorkerConfig>;
}

export interface OutboxWorker {
  start(): void;
  stop(): Promise<void>;
  /** Process one batch synchronously. Exposed for tests and admin tools. */
  drainOnce(): Promise<OutboxDrainStats>;
}

export interface OutboxDrainStats {
  claimed: number;
  dispatched: number;
  retried: number;
  failed: number;
}

interface BackoffParams {
  attempts: number;
  baseMs: number;
  maxMs: number;
  clock: Clock;
}

function nextAvailableAt(params: BackoffParams): Date {
  const exponent = Math.max(0, params.attempts - 1);
  const backoff = Math.min(params.maxMs, params.baseMs * 2 ** exponent);
  return new Date(params.clock.now().getTime() + backoff);
}

function rowToEvent(row: OutboxEventRow): OutboxEvent {
  // Trust: rows on the outbox table are written via OutboxPort.emit, which
  // types the payload. We reconstruct the discriminated union shape here.
  return {
    type: row.eventType as OutboxEventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    userId: row.userId ?? '',
    payload: row.payload,
  } as OutboxEvent;
}

export function createOutboxWorker(deps: OutboxWorkerDeps): OutboxWorker {
  const config: OutboxWorkerConfig = { ...DEFAULT_OUTBOX_WORKER_CONFIG, ...deps.config };
  const { outboxRepo, handlers, clock, logger } = deps;

  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let draining: Promise<void> | null = null;

  async function processRow(row: OutboxEventRow): Promise<'dispatched' | 'retried' | 'failed'> {
    const event = rowToEvent(row);
    try {
      await handlers.dispatch(event, row.id);
      await outboxRepo.markDispatched(row.id);
      logger.info(
        {
          eventId: row.id,
          eventType: row.eventType,
          aggregateId: row.aggregateId,
          attempts: row.attempts + 1,
        },
        'outbox event dispatched',
      );
      return 'dispatched';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextAttempts = row.attempts + 1;
      if (nextAttempts >= config.maxAttempts) {
        await outboxRepo.markFailed(row.id, message);
        logger.error(
          {
            eventId: row.id,
            eventType: row.eventType,
            aggregateId: row.aggregateId,
            attempts: nextAttempts,
            err: message,
          },
          'outbox event permanently failed after max attempts',
        );
        return 'failed';
      }
      const nextAvailable = nextAvailableAt({
        attempts: nextAttempts,
        baseMs: config.baseBackoffMs,
        maxMs: config.maxBackoffMs,
        clock,
      });
      await outboxRepo.markRetryable(row.id, message, nextAvailable);
      logger.warn(
        {
          eventId: row.id,
          eventType: row.eventType,
          aggregateId: row.aggregateId,
          attempts: nextAttempts,
          nextAvailableAt: nextAvailable,
          err: message,
        },
        'outbox event dispatch failed, retry scheduled',
      );
      return 'retried';
    }
  }

  async function drainOnce(): Promise<OutboxDrainStats> {
    const stats: OutboxDrainStats = { claimed: 0, dispatched: 0, retried: 0, failed: 0 };
    const claimed = await outboxRepo.claimPendingBatch({
      workerId: config.workerId,
      lockDurationMs: config.lockDurationMs,
      limit: config.batchSize,
    });
    stats.claimed = claimed.length;
    for (const row of claimed) {
      const outcome = await processRow(row);
      if (outcome === 'dispatched') stats.dispatched += 1;
      else if (outcome === 'retried') stats.retried += 1;
      else stats.failed += 1;
    }
    return stats;
  }

  async function tick(): Promise<void> {
    if (draining) return;
    draining = (async (): Promise<void> => {
      try {
        await drainOnce();
      } catch (err) {
        logger.error({ err }, 'outbox worker tick failed');
      } finally {
        draining = null;
      }
    })();
    await draining;
  }

  function start(): void {
    if (running) return;
    running = true;
    logger.info({ workerId: config.workerId }, 'outbox worker started');
    timer = setInterval(() => {
      void tick();
    }, config.pollIntervalMs);
  }

  async function stop(): Promise<void> {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (draining) await draining;
    logger.info({ workerId: config.workerId }, 'outbox worker stopped');
  }

  return { start, stop, drainOnce };
}
