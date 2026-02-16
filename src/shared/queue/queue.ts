import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../redis/redis';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('queue');

const QUEUE_NAME = 'order-polling';
let queue: Queue | null = null;
let worker: Worker | null = null;

export function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
    });
  }
  return queue;
}

export async function startWorker(processor: (job: Job) => Promise<void>): Promise<void> {
  if (worker) {
    log.warn('Worker already started');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      log.debug({ jobName: job.name }, 'Processing job');
      await processor(job);
    },
    {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobName: job?.name, err }, 'Job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ jobName: job.name }, 'Job completed');
  });

  log.info('Worker started');
}

export async function scheduleRepeatingJob(jobName: string, intervalMs: number): Promise<void> {
  const q = getQueue();
  await q.add(jobName, {}, { repeat: { every: intervalMs } });
  log.info({ jobName, intervalMs }, 'Repeating job scheduled');
}

export async function closeQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  log.info('Queue closed');
}
