import type { Prisma, PrismaClient, OutboxEventStatus } from '../../generated/prisma';

export interface OutboxEventRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  userId: string | null;
  status: OutboxEventStatus;
  attempts: number;
  lastError: string | null;
  availableAt: Date;
  lockedBy: string | null;
  lockedUntil: Date | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface CreateOutboxEventData {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  userId: string | null;
}

export interface LockClaim {
  workerId: string;
  lockDurationMs: number;
  limit: number;
}

export interface OutboxRepository {
  createEvent(data: CreateOutboxEventData, tx: Prisma.TransactionClient): Promise<OutboxEventRow>;
  /**
   * Claim up to `limit` PENDING events whose availableAt has elapsed.
   * Uses SELECT ... FOR UPDATE SKIP LOCKED to let multiple workers run
   * without fighting over rows. Returns the claimed rows with lockedBy
   * and lockedUntil set.
   */
  claimPendingBatch(claim: LockClaim): Promise<OutboxEventRow[]>;
  markDispatched(eventId: string): Promise<void>;
  /**
   * Mark event failed (retryable): bumps attempts, records error,
   * releases lock, sets availableAt to next retry per backoff.
   */
  markRetryable(eventId: string, error: string, nextAvailableAt: Date): Promise<void>;
  /**
   * Mark event permanently failed (max attempts exceeded). Releases
   * lock and records final error.
   */
  markFailed(eventId: string, error: string): Promise<void>;
  findById(eventId: string): Promise<OutboxEventRow | null>;
  findStuck(limit: number): Promise<OutboxEventRow[]>;
  countByStatus(): Promise<Record<OutboxEventStatus, number>>;
}

interface RawOutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Prisma.JsonValue;
  user_id: string | null;
  status: OutboxEventStatus;
  attempts: number;
  last_error: string | null;
  available_at: Date;
  locked_by: string | null;
  locked_until: Date | null;
  created_at: Date;
  published_at: Date | null;
}

function mapRow(row: RawOutboxRow): OutboxEventRow {
  return {
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: row.payload,
    userId: row.user_id,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    availableAt: row.available_at,
    lockedBy: row.locked_by,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

export function createOutboxRepository(prisma: PrismaClient): OutboxRepository {
  async function createEvent(
    data: CreateOutboxEventData,
    tx: Prisma.TransactionClient,
  ): Promise<OutboxEventRow> {
    const created = await tx.outboxEvent.create({
      data: {
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        eventType: data.eventType,
        payload: data.payload,
        userId: data.userId,
      },
    });
    return {
      id: created.id,
      aggregateType: created.aggregateType,
      aggregateId: created.aggregateId,
      eventType: created.eventType,
      payload: created.payload,
      userId: created.userId,
      status: created.status,
      attempts: created.attempts,
      lastError: created.lastError,
      availableAt: created.availableAt,
      lockedBy: created.lockedBy,
      lockedUntil: created.lockedUntil,
      createdAt: created.createdAt,
      publishedAt: created.publishedAt,
    };
  }

  async function claimPendingBatch(claim: LockClaim): Promise<OutboxEventRow[]> {
    // Atomic claim: CTE selects due rows with FOR UPDATE SKIP LOCKED,
    // then UPDATE stamps lock fields and returns the claimed rows.
    const lockUntil = new Date(Date.now() + claim.lockDurationMs);
    const rows = await prisma.$queryRaw<RawOutboxRow[]>`
      WITH claimed AS (
        SELECT id FROM outbox_events
        WHERE status = 'PENDING'
          AND available_at <= NOW()
          AND (locked_until IS NULL OR locked_until < NOW())
        ORDER BY available_at ASC
        LIMIT ${claim.limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events e
      SET locked_by = ${claim.workerId},
          locked_until = ${lockUntil}
      FROM claimed
      WHERE e.id = claimed.id
      RETURNING e.id, e.aggregate_type, e.aggregate_id, e.event_type, e.payload,
                e.user_id, e.status, e.attempts, e.last_error, e.available_at,
                e.locked_by, e.locked_until, e.created_at, e.published_at;
    `;
    return rows.map(mapRow);
  }

  async function markDispatched(eventId: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'DISPATCHED',
        publishedAt: new Date(),
        lockedBy: null,
        lockedUntil: null,
        lastError: null,
      },
    });
  }

  async function markRetryable(
    eventId: string,
    error: string,
    nextAvailableAt: Date,
  ): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        attempts: { increment: 1 },
        lastError: error,
        availableAt: nextAvailableAt,
        lockedBy: null,
        lockedUntil: null,
      },
    });
  }

  async function markFailed(eventId: string, error: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        attempts: { increment: 1 },
        status: 'FAILED',
        lastError: error,
        lockedBy: null,
        lockedUntil: null,
      },
    });
  }

  async function findById(eventId: string): Promise<OutboxEventRow | null> {
    const row = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!row) return null;
    return {
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: row.payload,
      userId: row.userId,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      availableAt: row.availableAt,
      lockedBy: row.lockedBy,
      lockedUntil: row.lockedUntil,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    };
  }

  async function findStuck(limit: number): Promise<OutboxEventRow[]> {
    const rows = await prisma.outboxEvent.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      aggregateType: r.aggregateType,
      aggregateId: r.aggregateId,
      eventType: r.eventType,
      payload: r.payload,
      userId: r.userId,
      status: r.status,
      attempts: r.attempts,
      lastError: r.lastError,
      availableAt: r.availableAt,
      lockedBy: r.lockedBy,
      lockedUntil: r.lockedUntil,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
    }));
  }

  async function countByStatus(): Promise<Record<OutboxEventStatus, number>> {
    const grouped = await prisma.outboxEvent.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const result: Record<OutboxEventStatus, number> = {
      PENDING: 0,
      DISPATCHED: 0,
      FAILED: 0,
    };
    for (const g of grouped) {
      result[g.status] = g._count._all;
    }
    return result;
  }

  return {
    createEvent,
    claimPendingBatch,
    markDispatched,
    markRetryable,
    markFailed,
    findById,
    findStuck,
    countByStatus,
  };
}
