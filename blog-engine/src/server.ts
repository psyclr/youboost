import 'dotenv/config';
import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { loadConfig } from './shared/config';
import { createApp } from './app';
import { logger } from './shared/logger';

async function main() {
  const config = loadConfig();

  // The driver adapter ignores the `?schema=` URL param, so pass it explicitly.
  const schema = new URL(config.databaseUrl).searchParams.get('schema') ?? undefined;
  const pool = new Pool({ connectionString: config.databaseUrl });
  const adapter = new PrismaPg(pool, schema ? { schema } : undefined);
  const prisma = new PrismaClient({ adapter });

  const app = await createApp(prisma, config);

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port }, 'blog-engine listening');
  } catch (err) {
    logger.error({ err }, 'Failed to start');
    await prisma.$disconnect();
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
