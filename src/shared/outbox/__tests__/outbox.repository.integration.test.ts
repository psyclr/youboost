/**
 * Integration tests for OutboxRepository against a real Postgres DB.
 *
 * These tests validate behavior that cannot be verified via mocks:
 *  - SELECT ... FOR UPDATE SKIP LOCKED actually locks rows per worker
 *  - Raw SQL claim query returns exactly the expected row shape
 *  - Atomic emit inside a Prisma transaction is rolled back on failure
 *
 * Skipped unless TEST_DATABASE_URL is provided. Local dev DB works:
 *    TEST_DATABASE_URL=postgresql://youboost:youboost_dev_password@localhost:5432/youboost_dev \
 *      npx jest outbox.repository.integration
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma';
import { createOutboxRepository, type OutboxRepository } from '../outbox.repository';

const DB_URL = process.env['TEST_DATABASE_URL'];
const describeDb = DB_URL ? describe : describe.skip;

describeDb('OutboxRepository (integration)', () => {
  let prisma: PrismaClient;
  let repo: OutboxRepository;

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: DB_URL! });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    repo = createOutboxRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean slate: delete only rows that belong to our test aggregateType
    await prisma.outboxEvent.deleteMany({
      where: { aggregateType: 'test-aggregate' },
    });
  });

  async function seed(
    count: number,
    overrides: Partial<{ status: 'PENDING' | 'DISPATCHED' | 'FAILED'; availableAt: Date }> = {},
  ): Promise<string[]> {
    const created = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        prisma.outboxEvent.create({
          data: {
            aggregateType: 'test-aggregate',
            aggregateId: crypto.randomUUID(),
            eventType: 'test.event',
            payload: { idx: i },
            userId: null,
            status: overrides.status ?? 'PENDING',
            availableAt: overrides.availableAt ?? new Date(Date.now() - 1000),
          },
        }),
      ),
    );
    return created.map((r) => r.id);
  }

  it('createEvent inserts a row inside the given transaction', async () => {
    const aggId = crypto.randomUUID();
    const created = await prisma.$transaction(async (tx) =>
      repo.createEvent(
        {
          aggregateType: 'test-aggregate',
          aggregateId: aggId,
          eventType: 'test.event',
          payload: { hello: 'world' },
          userId: null,
        },
        tx,
      ),
    );

    expect(created.id).toBeDefined();
    expect(created.status).toBe('PENDING');
    expect(created.payload).toEqual({ hello: 'world' });

    const fetched = await repo.findById(created.id);
    expect(fetched?.id).toBe(created.id);
  });

  it('createEvent is rolled back when transaction fails', async () => {
    const aggId = crypto.randomUUID();
    let createdId: string | undefined;

    await expect(
      prisma.$transaction(async (tx) => {
        const row = await repo.createEvent(
          {
            aggregateType: 'test-aggregate',
            aggregateId: aggId,
            eventType: 'test.event',
            payload: { rolled: 'back' },
            userId: null,
          },
          tx,
        );
        createdId = row.id;
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const fetched = createdId ? await repo.findById(createdId) : null;
    expect(fetched).toBeNull();
  });

  it('claimPendingBatch selects PENDING rows whose availableAt has elapsed', async () => {
    const pendingDue = await seed(2, { availableAt: new Date(Date.now() - 1000) });
    const pendingFuture = await seed(1, { availableAt: new Date(Date.now() + 3600_000) });
    await seed(1, { status: 'DISPATCHED' });

    const claimed = await repo.claimPendingBatch({
      workerId: 'worker-A',
      lockDurationMs: 60_000,
      limit: 10,
    });

    const claimedIds = claimed.map((r) => r.id).sort();
    expect(claimedIds).toEqual(pendingDue.sort());
    expect(claimed.every((r) => r.lockedBy === 'worker-A')).toBe(true);
    expect(claimed.every((r) => r.lockedUntil !== null)).toBe(true);
    // Future-availability row untouched
    const future = await repo.findById(pendingFuture[0]!);
    expect(future?.lockedBy).toBeNull();
  });

  it('concurrent claimPendingBatch: each worker gets distinct rows (SKIP LOCKED)', async () => {
    const ids = await seed(10);

    const [batchA, batchB] = await Promise.all([
      repo.claimPendingBatch({ workerId: 'worker-A', lockDurationMs: 60_000, limit: 10 }),
      repo.claimPendingBatch({ workerId: 'worker-B', lockDurationMs: 60_000, limit: 10 }),
    ]);

    const aIds = new Set(batchA.map((r) => r.id));
    const bIds = new Set(batchB.map((r) => r.id));
    const intersection = [...aIds].filter((id) => bIds.has(id));

    expect(intersection).toHaveLength(0);
    expect(aIds.size + bIds.size).toBe(ids.length);
  });

  it('limit caps batch size', async () => {
    await seed(5);
    const claimed = await repo.claimPendingBatch({
      workerId: 'worker-A',
      lockDurationMs: 60_000,
      limit: 2,
    });
    expect(claimed).toHaveLength(2);
  });

  it('markDispatched sets status and publishedAt, clears lock', async () => {
    const [id] = await seed(1);
    await repo.claimPendingBatch({ workerId: 'worker-A', lockDurationMs: 60_000, limit: 1 });

    await repo.markDispatched(id!);

    const row = await repo.findById(id!);
    expect(row?.status).toBe('DISPATCHED');
    expect(row?.publishedAt).not.toBeNull();
    expect(row?.lockedBy).toBeNull();
    expect(row?.lockedUntil).toBeNull();
  });

  it('markRetryable bumps attempts, records error, reschedules', async () => {
    const [id] = await seed(1);
    const nextAt = new Date(Date.now() + 30_000);

    await repo.markRetryable(id!, 'transient failure', nextAt);

    const row = await repo.findById(id!);
    expect(row?.status).toBe('PENDING');
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toBe('transient failure');
    expect(row?.availableAt.getTime()).toBe(nextAt.getTime());
    expect(row?.lockedBy).toBeNull();
  });

  it('markFailed sets status to FAILED and records error', async () => {
    const [id] = await seed(1);
    await repo.markFailed(id!, 'permanent failure');
    const row = await repo.findById(id!);
    expect(row?.status).toBe('FAILED');
    expect(row?.lastError).toBe('permanent failure');
  });

  it('countByStatus returns counts per status', async () => {
    await seed(3, { status: 'PENDING' });
    await seed(2, { status: 'DISPATCHED' });
    await seed(1, { status: 'FAILED' });

    const counts = await repo.countByStatus();

    expect(counts.PENDING).toBeGreaterThanOrEqual(3);
    expect(counts.DISPATCHED).toBeGreaterThanOrEqual(2);
    expect(counts.FAILED).toBeGreaterThanOrEqual(1);
  });
});
