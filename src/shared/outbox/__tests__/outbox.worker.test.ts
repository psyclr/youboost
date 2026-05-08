import { createFixedClock } from '../../utils/clock';
import { createHandlerRegistry, type OutboxHandler } from '../handlers';
import { createOutboxWorker } from '../outbox.worker';
import type {
  OutboxRepository,
  OutboxEventRow,
  LockClaim,
  CreateOutboxEventData,
} from '../outbox.repository';
import type { Prisma } from '../../../generated/prisma';

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

function makeRow(overrides: Partial<OutboxEventRow> = {}): OutboxEventRow {
  return {
    id: overrides.id ?? 'ev-1',
    aggregateType: 'order',
    aggregateId: 'ord-1',
    eventType: 'order.created',
    payload: {
      orderId: 'ord-1',
      userId: 'user-1',
      status: 'PROCESSING',
      price: 10,
    },
    userId: 'user-1',
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    availableAt: new Date('2026-05-07T12:00:00Z'),
    lockedBy: null,
    lockedUntil: null,
    createdAt: new Date('2026-05-07T11:59:00Z'),
    publishedAt: null,
    ...overrides,
  };
}

function createFakeRepo(initialRows: OutboxEventRow[] = []): {
  repo: OutboxRepository;
  state: {
    rows: OutboxEventRow[];
    marked: {
      dispatched: string[];
      retried: Array<{ id: string; err: string; at: Date }>;
      failed: Array<{ id: string; err: string }>;
    };
  };
} {
  const rows = [...initialRows];
  const marked = {
    dispatched: [] as string[],
    retried: [] as Array<{ id: string; err: string; at: Date }>,
    failed: [] as Array<{ id: string; err: string }>,
  };
  const repo: OutboxRepository = {
    async createEvent(
      _data: CreateOutboxEventData,
      _tx: Prisma.TransactionClient,
    ): Promise<OutboxEventRow> {
      throw new Error('not used in worker tests');
    },
    async claimPendingBatch(claim: LockClaim): Promise<OutboxEventRow[]> {
      const claimable = rows.filter((r) => r.status === 'PENDING').slice(0, claim.limit);
      for (const row of claimable) {
        row.lockedBy = claim.workerId;
        row.lockedUntil = new Date(Date.now() + claim.lockDurationMs);
      }
      return claimable.map((r) => ({ ...r }));
    },
    async markDispatched(eventId: string): Promise<void> {
      marked.dispatched.push(eventId);
      const row = rows.find((r) => r.id === eventId);
      if (row) row.status = 'DISPATCHED';
    },
    async markRetryable(eventId: string, err: string, nextAvailableAt: Date): Promise<void> {
      marked.retried.push({ id: eventId, err, at: nextAvailableAt });
      const row = rows.find((r) => r.id === eventId);
      if (row) {
        row.attempts += 1;
        row.lastError = err;
        row.availableAt = nextAvailableAt;
        row.lockedBy = null;
        row.lockedUntil = null;
      }
    },
    async markFailed(eventId: string, err: string): Promise<void> {
      marked.failed.push({ id: eventId, err });
      const row = rows.find((r) => r.id === eventId);
      if (row) {
        row.attempts += 1;
        row.lastError = err;
        row.status = 'FAILED';
      }
    },
    async findById(eventId: string): Promise<OutboxEventRow | null> {
      const row = rows.find((r) => r.id === eventId);
      return row ? { ...row } : null;
    },
    async findStuck(): Promise<OutboxEventRow[]> {
      return rows.filter((r) => r.status !== 'DISPATCHED').map((r) => ({ ...r }));
    },
    async countByStatus() {
      const out = { PENDING: 0, DISPATCHED: 0, FAILED: 0 };
      for (const r of rows) out[r.status] += 1;
      return out;
    },
  };
  return { repo, state: { rows, marked } };
}

describe('OutboxWorker.drainOnce', () => {
  const clock = createFixedClock('2026-05-07T12:00:00Z');

  it('dispatches claimed rows to matching handlers', async () => {
    const { repo, state } = createFakeRepo([makeRow({ id: 'ev-1' }), makeRow({ id: 'ev-2' })]);
    const handled: string[] = [];
    const handlers = createHandlerRegistry([
      {
        eventType: 'order.created',
        name: 'log',
        handle: async (_event, id) => {
          handled.push(id);
        },
      } satisfies OutboxHandler,
    ]);
    const worker = createOutboxWorker({
      outboxRepo: repo,
      handlers,
      clock,
      logger: silentLogger,
    });

    const stats = await worker.drainOnce();

    expect(stats).toEqual({ claimed: 2, dispatched: 2, retried: 0, failed: 0 });
    expect(handled).toEqual(['ev-1', 'ev-2']);
    expect(state.marked.dispatched).toEqual(['ev-1', 'ev-2']);
  });

  it('retries on handler failure below maxAttempts with exponential backoff', async () => {
    const { repo, state } = createFakeRepo([makeRow({ id: 'ev-1' })]);
    const handlers = createHandlerRegistry([
      {
        eventType: 'order.created',
        name: 'failing',
        handle: async () => {
          throw new Error('handler broken');
        },
      } satisfies OutboxHandler,
    ]);
    const worker = createOutboxWorker({
      outboxRepo: repo,
      handlers,
      clock,
      logger: silentLogger,
      config: { baseBackoffMs: 1_000, maxBackoffMs: 60_000, maxAttempts: 5 },
    });

    const stats = await worker.drainOnce();

    expect(stats).toEqual({ claimed: 1, dispatched: 0, retried: 1, failed: 0 });
    expect(state.marked.retried).toHaveLength(1);
    expect(state.marked.retried[0]?.err).toBe('handler broken');
    // First retry after attempt 1 => baseMs * 2^0 = 1000ms from clock.now()
    const expected = clock.now().getTime() + 1_000;
    expect(state.marked.retried[0]?.at.getTime()).toBe(expected);
  });

  it('marks FAILED once attempts reaches maxAttempts', async () => {
    const { repo, state } = createFakeRepo([makeRow({ id: 'ev-1', attempts: 4 })]);
    const handlers = createHandlerRegistry([
      {
        eventType: 'order.created',
        name: 'failing',
        handle: async () => {
          throw new Error('still broken');
        },
      } satisfies OutboxHandler,
    ]);
    const worker = createOutboxWorker({
      outboxRepo: repo,
      handlers,
      clock,
      logger: silentLogger,
      config: { maxAttempts: 5, baseBackoffMs: 1_000, maxBackoffMs: 60_000 },
    });

    const stats = await worker.drainOnce();

    expect(stats).toEqual({ claimed: 1, dispatched: 0, retried: 0, failed: 1 });
    expect(state.marked.failed).toEqual([{ id: 'ev-1', err: 'still broken' }]);
  });

  it('backoff caps at maxBackoffMs', async () => {
    const { repo, state } = createFakeRepo([makeRow({ id: 'ev-1', attempts: 20 })]);
    const handlers = createHandlerRegistry([
      {
        eventType: 'order.created',
        name: 'failing',
        handle: async () => {
          throw new Error('still broken');
        },
      } satisfies OutboxHandler,
    ]);
    const worker = createOutboxWorker({
      outboxRepo: repo,
      handlers,
      clock,
      logger: silentLogger,
      config: { maxAttempts: 999, baseBackoffMs: 1_000, maxBackoffMs: 10_000 },
    });

    await worker.drainOnce();
    const retry = state.marked.retried[0];
    expect(retry).toBeDefined();
    expect(retry?.at.getTime()).toBe(clock.now().getTime() + 10_000);
  });

  it('empty batch returns zero stats', async () => {
    const { repo } = createFakeRepo([]);
    const handlers = createHandlerRegistry([]);
    const worker = createOutboxWorker({
      outboxRepo: repo,
      handlers,
      clock,
      logger: silentLogger,
    });

    await expect(worker.drainOnce()).resolves.toEqual({
      claimed: 0,
      dispatched: 0,
      retried: 0,
      failed: 0,
    });
  });
});
