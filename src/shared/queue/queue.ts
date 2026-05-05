import { Queue, Worker, type Job, type Processor } from 'bullmq';
import { getRedis } from '../redis/redis';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('queue');

interface QueueHandle {
  queue: Queue;
  worker: Worker | null;
}

const handles = new Map<string, QueueHandle>();

export interface WorkerOptions {
  /**
   * retryable=true → processor errors re-throw so BullMQ retries per its
   *   attempts/backoff config (use for idempotent-unsafe side effects
   *   like outbound HTTP webhooks and email delivery).
   * retryable=false → processor errors are caught + logged, job marks
   *   complete (use for idempotent scheduled sweeps like deposit expiry
   *   and drip-feed ticks that re-run on next interval anyway).
   */
  retryable?: boolean;
  concurrency?: number;
}

export function getNamedQueue(name: string): Queue {
  const existing = handles.get(name);
  if (existing) return existing.queue;

  const queue = new Queue(name, {
    connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
  });
  handles.set(name, { queue, worker: null });
  return queue;
}

export async function startNamedWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  options: WorkerOptions = {},
): Promise<void> {
  const existing = handles.get(name);
  if (existing?.worker) {
    log.warn({ name }, 'Worker already started');
    return;
  }

  const { retryable = true, concurrency = 1 } = options;

  const wrapped: Processor<T> = async (job: Job<T>) => {
    log.debug({ name, jobName: job.name }, 'Processing job');
    try {
      await processor(job);
    } catch (err) {
      log.error({ name, jobName: job.name, err }, 'Job processor error');
      if (retryable) throw err;
    }
  };

  const worker = new Worker<T>(name, wrapped, {
    connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
    concurrency,
  });

  worker.on('failed', (job, err) => {
    log.error({ name, jobName: job?.name, err }, 'Job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ name, jobName: job.name }, 'Job completed');
  });

  // getNamedQueue has the side-effect of registering the handle so we
  // reuse it here rather than replacing.
  getNamedQueue(name);
  const handle = handles.get(name);
  if (handle) handle.worker = worker;

  log.info({ name, retryable, concurrency }, 'Worker started');
}

export async function stopNamedWorker(name: string): Promise<void> {
  const handle = handles.get(name);
  if (!handle) return;
  if (handle.worker) {
    await handle.worker.close();
    handle.worker = null;
  }
  await handle.queue.close();
  handles.delete(name);
  log.info({ name }, 'Worker stopped');
}

export async function closeAllQueues(): Promise<void> {
  const names = [...handles.keys()];
  for (const name of names) {
    await stopNamedWorker(name);
  }
}

// Backward-compat shim for the original shared queue API (order-polling
// singleton). Keep existing callers working until they migrate.
const LEGACY_QUEUE_NAME = 'order-polling';

export function getQueue(): Queue {
  return getNamedQueue(LEGACY_QUEUE_NAME);
}

export async function startWorker(processor: (job: Job) => Promise<void>): Promise<void> {
  await startNamedWorker(LEGACY_QUEUE_NAME, processor, { retryable: true, concurrency: 1 });
}

export async function scheduleRepeatingJob(jobName: string, intervalMs: number): Promise<void> {
  const q = getNamedQueue(LEGACY_QUEUE_NAME);
  await q.add(jobName, {}, { repeat: { every: intervalMs } });
  log.info({ jobName, intervalMs }, 'Repeating job scheduled');
}

export async function closeQueue(): Promise<void> {
  await stopNamedWorker(LEGACY_QUEUE_NAME);
}
