import type { Logger } from 'pino';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import type { DepositRepository } from '../deposit.repository';
import type { DepositLifecycleService } from '../deposit-lifecycle.service';

const QUEUE_NAME = 'deposit-expiry';
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export interface DepositExpiryWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface DepositExpiryWorkerDeps {
  depositRepo: DepositRepository;
  lifecycle: DepositLifecycleService;
  logger: Logger;
}

export function createDepositExpiryWorker(deps: DepositExpiryWorkerDeps): DepositExpiryWorker {
  const { depositRepo, lifecycle, logger } = deps;

  async function processExpiredDeposits(): Promise<void> {
    const expired = await depositRepo.findExpiredPendingDeposits();
    if (expired.length === 0) {
      logger.debug('No expired pending deposits');
      return;
    }

    logger.info({ count: expired.length }, 'Expiring pending deposits');

    for (const deposit of expired) {
      try {
        await lifecycle.failDepositTransaction(deposit.id, 'expiry', 'expired');
        logger.info({ depositId: deposit.id, userId: deposit.userId }, 'Deposit expired');
      } catch (err) {
        logger.error({ depositId: deposit.id, err }, 'Failed to expire deposit');
      }
    }
  }

  async function start(): Promise<void> {
    await startNamedWorker(
      QUEUE_NAME,
      async () => {
        await processExpiredDeposits();
      },
      { retryable: false, concurrency: 1 },
    );

    const q = getNamedQueue(QUEUE_NAME);
    await q.add('deposit-expiry-tick', {}, { repeat: { every: CHECK_INTERVAL_MS } });

    logger.info({ intervalMs: CHECK_INTERVAL_MS }, 'Deposit expiry worker started');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Deposit expiry worker stopped');
  }

  return { start, stop };
}
