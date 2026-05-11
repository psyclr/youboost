import type { Logger } from 'pino';
import type { OutboxRepository, OutboxEventRow } from '../../shared/outbox';
import type { OutboxEventStatus } from '../../generated/prisma';

export interface OutboxEventSummary {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  userId: string | null;
  status: OutboxEventStatus;
  attempts: number;
  lastError: string | null;
  availableAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface OutboxStatsResponse {
  counts: Record<OutboxEventStatus, number>;
  stuck: OutboxEventSummary[];
}

export interface AdminOutboxService {
  getStats(limit?: number): Promise<OutboxStatsResponse>;
}

export interface AdminOutboxServiceDeps {
  outboxRepo: OutboxRepository;
  logger: Logger;
}

function toSummary(row: OutboxEventRow): OutboxEventSummary {
  return {
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    userId: row.userId,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    availableAt: row.availableAt,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
  };
}

export function createAdminOutboxService(deps: AdminOutboxServiceDeps): AdminOutboxService {
  const { outboxRepo } = deps;

  async function getStats(limit: number = 50): Promise<OutboxStatsResponse> {
    const [counts, stuck] = await Promise.all([
      outboxRepo.countByStatus(),
      outboxRepo.findStuck(limit),
    ]);
    return { counts, stuck: stuck.map(toSummary) };
  }

  return { getStats };
}
