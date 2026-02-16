import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('database');

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const url = process.env['DATABASE_URL'] ?? '';
    const adapter = new PrismaPg({ connectionString: url });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

export async function connectDatabase(): Promise<void> {
  const client = getPrisma();
  await client.$connect();
  log.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    log.info('Database disconnected');
  }
}

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const client = getPrisma();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    log.error({ err: error }, 'Database health check failed');
    return false;
  }
}
