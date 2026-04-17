import { startWorker, scheduleRepeatingJob, closeQueue } from '../../../shared/queue';
import { getConfig } from '../../../shared/config';
import { createServiceLogger } from '../../../shared/utils/logger';
import { pollOrderStatuses } from './status-poll.worker';

export { startDripFeedWorker, stopDripFeedWorker } from './drip-feed.worker';
export { startOrderTimeoutWorker, stopOrderTimeoutWorker } from './order-timeout.worker';

const log = createServiceLogger('order-polling');

export async function startOrderPolling(): Promise<void> {
  const config = getConfig();

  await startWorker(async () => {
    await pollOrderStatuses();
  });

  await scheduleRepeatingJob('poll-order-statuses', config.polling.intervalMs);
  log.info({ intervalMs: config.polling.intervalMs }, 'Order polling started');
}

export async function stopOrderPolling(): Promise<void> {
  await closeQueue();
  log.info('Order polling stopped');
}
