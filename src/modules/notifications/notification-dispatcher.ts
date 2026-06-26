import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../shared/queue';
import type { NotificationRepository } from './notification.repository';
import type { EmailProvider } from './utils/email-provider';

const QUEUE_NAME = 'notification-delivery';

interface NotificationJobData {
  notificationId: string;
}

export interface NotificationDispatcher {
  enqueueNotification(notificationId: string): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface NotificationDispatcherDeps {
  notificationRepo: NotificationRepository;
  emailProvider: EmailProvider;
  /**
   * Resolve the logical `user-email` channel to the recipient's actual address
   * (by the notification's userId). Handlers store `channel: 'user-email'` rather
   * than the address, so delivery must resolve it here. Optional for tests that
   * pass an explicit address as the channel.
   */
  resolveRecipientEmail?: (userId: string) => Promise<string | null>;
  logger: Logger;
}

export function createNotificationDispatcher(
  deps: NotificationDispatcherDeps,
): NotificationDispatcher {
  const { notificationRepo, emailProvider, resolveRecipientEmail, logger } = deps;

  /**
   * The destination address for a notification. An explicit address (contains
   * `@`) is used as-is; the logical `user-email` channel is resolved to the
   * user's address. Returns null when it can't be resolved (caller fails the
   * notification instead of sending to a bogus recipient).
   */
  async function resolveRecipient(notification: {
    channel: string;
    userId: string;
  }): Promise<string | null> {
    if (notification.channel.includes('@')) return notification.channel;
    if (notification.channel === 'user-email' && resolveRecipientEmail) {
      return resolveRecipientEmail(notification.userId);
    }
    return null;
  }

  async function enqueueNotification(notificationId: string): Promise<void> {
    try {
      const q = getNamedQueue(QUEUE_NAME);
      const jobData: NotificationJobData = { notificationId };

      await q.add('deliver-notification', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      });

      logger.info({ notificationId }, 'Notification delivery enqueued');
    } catch (err) {
      logger.error({ err, notificationId }, 'Failed to enqueue notification');
    }
  }

  async function processNotificationDelivery(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId } = job.data;

    const notification = await notificationRepo.findNotificationById(notificationId);
    if (!notification) {
      logger.warn({ notificationId }, 'Notification not found, skipping');
      return;
    }

    if (notification.status !== 'PENDING') {
      logger.debug(
        { notificationId, status: notification.status },
        'Notification not pending, skipping',
      );
      return;
    }

    const to = await resolveRecipient(notification);
    if (!to) {
      // Unresolvable recipient is permanent — fail without throwing so the job
      // is not retried forever.
      const reason = `No recipient for channel '${notification.channel}'`;
      await notificationRepo.updateNotificationStatus(notificationId, 'FAILED', reason);
      logger.error({ notificationId, channel: notification.channel }, reason);
      return;
    }

    try {
      await emailProvider.send({
        to,
        subject: notification.subject ?? '',
        body: notification.body,
      });

      await notificationRepo.updateNotificationStatus(notificationId, 'SENT');
      logger.info({ notificationId }, 'Notification delivered');
    } catch (err) {
      await notificationRepo.incrementRetryCount(notificationId);
      const reason = err instanceof Error ? err.message : 'Unknown error';
      await notificationRepo.updateNotificationStatus(notificationId, 'FAILED', reason);
      logger.error({ err, notificationId }, 'Notification delivery failed');
      throw err;
    }
  }

  async function start(): Promise<void> {
    await startNamedWorker<NotificationJobData>(
      QUEUE_NAME,
      async (job) => {
        await processNotificationDelivery(job);
      },
      { retryable: true, concurrency: 3 },
    );
    logger.info('Notification worker started');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Notification worker stopped');
  }

  return { enqueueNotification, start, stop };
}
