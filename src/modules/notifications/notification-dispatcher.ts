import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../../shared/redis/redis';
import { createServiceLogger } from '../../shared/utils/logger';
import { emailProvider } from './utils/stub-email-provider';
import * as repo from './notification.repository';

const log = createServiceLogger('notification-dispatcher');

const QUEUE_NAME = 'notification-delivery';
let queue: Queue | null = null;
let worker: Worker | null = null;

interface NotificationJobData {
  notificationId: string;
}

function getNotificationQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
    });
  }
  return queue;
}

export async function enqueueNotification(notificationId: string): Promise<void> {
  try {
    const q = getNotificationQueue();
    const jobData: NotificationJobData = { notificationId };

    await q.add('deliver-notification', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });

    log.info({ notificationId }, 'Notification delivery enqueued');
  } catch (err) {
    log.error({ err, notificationId }, 'Failed to enqueue notification');
  }
}

export async function processNotificationDelivery(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId } = job.data;

  const notification = await repo.findNotificationById(notificationId);
  if (!notification) {
    log.warn({ notificationId }, 'Notification not found, skipping');
    return;
  }

  if (notification.status !== 'PENDING') {
    log.debug(
      { notificationId, status: notification.status },
      'Notification not pending, skipping',
    );
    return;
  }

  try {
    await emailProvider.send({
      to: notification.channel,
      subject: notification.subject ?? '',
      body: notification.body,
    });

    await repo.updateNotificationStatus(notificationId, 'SENT');
    log.info({ notificationId }, 'Notification delivered');
  } catch (err) {
    await repo.incrementRetryCount(notificationId);
    const reason = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateNotificationStatus(notificationId, 'FAILED', reason);
    log.error({ err, notificationId }, 'Notification delivery failed');
    throw err;
  }
}

export async function startNotificationWorker(): Promise<void> {
  if (worker) {
    log.warn('Notification worker already started');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job<NotificationJobData>) => {
      log.debug(
        { jobName: job.name, notificationId: job.data.notificationId },
        'Processing notification delivery',
      );
      await processNotificationDelivery(job);
    },
    {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobName: job?.name, err }, 'Notification delivery job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ jobName: job.name }, 'Notification delivery job completed');
  });

  log.info('Notification worker started');
}

export async function stopNotificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  log.info('Notification worker stopped');
}
