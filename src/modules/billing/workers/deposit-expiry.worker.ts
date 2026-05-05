import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import { createServiceLogger } from '../../../shared/utils/logger';
import { findExpiredPendingDeposits, updateDepositStatus } from '../deposit.repository';

const log = createServiceLogger('deposit-expiry');

const QUEUE_NAME = 'deposit-expiry';
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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
  await startNamedWorker(
    QUEUE_NAME,
    async () => {
      await processExpiredDeposits();
    },
    { retryable: false, concurrency: 1 },
  );

  const q = getNamedQueue(QUEUE_NAME);
  await q.add('deposit-expiry-tick', {}, { repeat: { every: CHECK_INTERVAL_MS } });

  log.info({ intervalMs: CHECK_INTERVAL_MS }, 'Deposit expiry worker started');
}

export async function stopDepositExpiryWorker(): Promise<void> {
  await stopNamedWorker(QUEUE_NAME);
  log.info('Deposit expiry worker stopped');
}
