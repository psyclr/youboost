import 'dotenv/config';
import { loadConfig } from './shared/config/env';
import { createServiceLogger } from './shared/utils/logger';
import { connectDatabase, disconnectDatabase } from './shared/database/prisma';
import { connectRedis, disconnectRedis } from './shared/redis/redis';
import {
  startOrderPolling,
  stopOrderPolling,
  startDripFeedWorker,
  stopDripFeedWorker,
  startOrderTimeoutWorker,
  stopOrderTimeoutWorker,
} from './modules/orders/workers';
import { startWebhookWorker, stopWebhookWorker } from './modules/webhooks';
import { startNotificationWorker, stopNotificationWorker } from './modules/notifications';
import { startDepositExpiryWorker, stopDepositExpiryWorker } from './modules/billing';
import { createApp } from './app';

const log = createServiceLogger('main');

async function main(): Promise<void> {
  const config = loadConfig();
  log.info({ env: config.app.nodeEnv }, 'Starting youboost server');

  await connectDatabase();
  await connectRedis();

  const app = await createApp();
  await app.listen({ port: config.app.port, host: '0.0.0.0' });
  log.info({ port: config.app.port }, 'Server listening');

  await startOrderPolling();
  await startDripFeedWorker();
  await startOrderTimeoutWorker();
  await startDepositExpiryWorker();
  await startWebhookWorker();
  await startNotificationWorker();

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Graceful shutdown initiated');
    await app.close();
    await stopNotificationWorker();
    await stopWebhookWorker();
    await stopDepositExpiryWorker();
    await stopOrderTimeoutWorker();
    await stopDripFeedWorker();
    await stopOrderPolling();
    await disconnectRedis();
    await disconnectDatabase();
    log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

main().catch((error) => {
  // NOSONAR — top-level await requires ESM migration
  log.error({ err: error }, 'Fatal startup error');
  process.exit(1);
});
