import type { Job } from 'bullmq';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../shared/queue';
import { createServiceLogger } from '../../shared/utils/logger';
import { getEmailProvider } from './utils/email-provider-factory';
import * as repo from './notification.repository';

const log = createServiceLogger('notification-dispatcher');

const QUEUE_NAME = 'notification-delivery';

interface NotificationJobData {
  notificationId: string;
}

export async function enqueueNotification(notificationId: string): Promise<void> {
  try {
    const q = getNamedQueue(QUEUE_NAME);
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
    const emailProvider = getEmailProvider();
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
  await startNamedWorker<NotificationJobData>(
    QUEUE_NAME,
    async (job) => {
      await processNotificationDelivery(job);
    },
    { retryable: true, concurrency: 3 },
  );
  log.info('Notification worker started');
}

export async function stopNotificationWorker(): Promise<void> {
  await stopNamedWorker(QUEUE_NAME);
  log.info('Notification worker stopped');
}
