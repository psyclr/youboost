import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import { getConfig } from '../../../shared/config';
import { createServiceLogger } from '../../../shared/utils/logger';
import { pollOrderStatuses } from './status-poll.worker';

export { startDripFeedWorker, stopDripFeedWorker } from './drip-feed.worker';
export { startOrderTimeoutWorker, stopOrderTimeoutWorker } from './order-timeout.worker';

const log = createServiceLogger('order-polling');

const QUEUE_NAME = 'order-polling';

export async function startOrderPolling(): Promise<void> {
  const config = getConfig();

  await startNamedWorker(
    QUEUE_NAME,
    async () => {
      await pollOrderStatuses();
    },
    { retryable: false, concurrency: 1 },
  );

  const q = getNamedQueue(QUEUE_NAME);
  await q.add('poll-order-statuses', {}, { repeat: { every: config.polling.intervalMs } });
  log.info({ intervalMs: config.polling.intervalMs }, 'Order polling started');
}

export async function stopOrderPolling(): Promise<void> {
  await stopNamedWorker(QUEUE_NAME);
  log.info('Order polling stopped');
}
