import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../../../shared/redis/redis';
import { createServiceLogger } from '../../../shared/utils/logger';
import { findExpiredPendingDeposits, updateDepositStatus } from '../deposit.repository';

const log = createServiceLogger('deposit-expiry');

const QUEUE_NAME = 'deposit-expiry';
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let queue: Queue | null = null;
let worker: Worker | null = null;

function getExpiryQueue(): Queue {
  queue ??= new Queue(QUEUE_NAME, {
    connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
  });
  return queue;
}

async function processExpiredDeposits(): Promise<void> {
  const expired = await findExpiredPendingDeposits();
  if (expired.length === 0) {
    log.debug('No expired pending deposits');
    return;
  }

  log.info({ count: expired.length }, 'Expiring pending deposits');

  for (const deposit of expired) {
    try {
      await updateDepositStatus(deposit.id, { status: 'EXPIRED' });
      log.info({ depositId: deposit.id, userId: deposit.userId }, 'Deposit expired');
    } catch (err) {
      log.error({ depositId: deposit.id, err }, 'Failed to expire deposit');
    }
  }
}

export async function startDepositExpiryWorker(): Promise<void> {
  if (worker) {
    log.warn('Deposit expiry worker already started');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await processExpiredDeposits();
    },
    {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobName: job?.name, err }, 'Deposit expiry job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ jobName: job.name }, 'Deposit expiry job completed');
  });

  const q = getExpiryQueue();
  await q.add('deposit-expiry-tick', {}, { repeat: { every: CHECK_INTERVAL_MS } });

  log.info({ intervalMs: CHECK_INTERVAL_MS }, 'Deposit expiry worker started');
}

export async function stopDepositExpiryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  log.info('Deposit expiry worker stopped');
}
