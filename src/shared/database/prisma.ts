import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('database');

export interface CreatePrismaClientOptions {
  databaseUrl: string;
}

export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({ connectionString: options.databaseUrl });
  return new PrismaClient({ adapter });
}

export async function connectPrisma(client: PrismaClient): Promise<void> {
  await client.$connect();
  log.info('Database connected');
}

export async function disconnectPrisma(client: PrismaClient): Promise<void> {
  await client.$disconnect();
  log.info('Database disconnected');
}

export async function isPrismaHealthy(client: PrismaClient): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    log.error({ err: error }, 'Database health check failed');
    return false;
  }
}
