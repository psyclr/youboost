import type { FastifyInstance } from 'fastify';
import { applyTestEnv } from './test-config';
import { resetConfig, loadConfig } from '@/shared/config/env';
import { createApp } from '@/app';
import { disconnectDatabase } from '@/shared/database/prisma';
import { disconnectRedis } from '@/shared/redis/redis';

export async function createTestApp(
  envOverrides?: Record<string, string>,
): Promise<FastifyInstance> {
  applyTestEnv();
  if (envOverrides) {
    for (const [key, value] of Object.entries(envOverrides)) {
      process.env[key] = value;
    }
  }
  resetConfig();
  loadConfig();
  const app = await createApp();
  await app.ready();
  return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
  try {
    await disconnectDatabase();
  } catch {
    // pg/pgpass compat issue with Node 25.x — safe to ignore in teardown
  }
  try {
    await disconnectRedis();
  } catch {
    // safe to ignore in teardown
  }
  resetConfig();
}
