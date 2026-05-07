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

// Deprecated — singleton shim kept during Phase F1-F2 so unconverted modules still compile.
// Delete in Phase 18 (sweep) after every module is factory-based.
let sharedPrisma: PrismaClient | null = null;

export function setSharedPrisma(client: PrismaClient): void {
  sharedPrisma = client;
}

export function getPrisma(): PrismaClient {
  if (!sharedPrisma) {
    sharedPrisma = createPrismaClient({ databaseUrl: process.env['DATABASE_URL'] ?? '' });
  }
  return sharedPrisma;
}

export async function connectDatabase(): Promise<void> {
  await connectPrisma(getPrisma());
}

export async function disconnectDatabase(): Promise<void> {
  if (sharedPrisma) {
    await disconnectPrisma(sharedPrisma);
    sharedPrisma = null;
  }
}

export async function isDatabaseHealthy(): Promise<boolean> {
  return isPrismaHealthy(getPrisma());
}
