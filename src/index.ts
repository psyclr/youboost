import 'dotenv/config';
import { loadConfig } from './shared/config/env';
import { createServiceLogger } from './shared/utils/logger';
import { createPrismaClient, connectPrisma, disconnectPrisma } from './shared/database/prisma';
import { createRedisClient, connectRedisClient, disconnectRedisClient } from './shared/redis/redis';
import { setSharedRedis } from './shared/redis/redis';
import { createEmailProvider } from './modules/notifications';
import { createApp } from './app';

const log = createServiceLogger('main');

async function main(): Promise<void> {
  const config = loadConfig();
  log.info({ env: config.app.nodeEnv }, 'Starting youboost server');

  const prisma = createPrismaClient({ databaseUrl: config.db.url });
  await connectPrisma(prisma);

  const redis = createRedisClient({ url: config.redis.url });
  // Wire the shared redis handle before queue infra is touched (queue.ts
  // reads through shared/redis/redis.ts::getRedis as an internal helper).
  setSharedRedis(redis);
  await connectRedisClient(redis);

  const emailProvider = createEmailProvider({
    smtp: config.smtp,
    logger: createServiceLogger('email-provider-factory'),
  });

  const { app, workers } = await createApp({ prisma, redis, emailProvider, config });
  await app.listen({ port: config.app.port, host: '0.0.0.0' });
  log.info({ port: config.app.port }, 'Server listening');

  await workers.start();

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Graceful shutdown initiated');
    await app.close();
    await workers.stop();
    await disconnectRedisClient(redis);
    await disconnectPrisma(prisma);
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
