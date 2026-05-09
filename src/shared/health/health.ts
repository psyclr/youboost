import type Redis from 'ioredis';
import type { PrismaClient } from '../../generated/prisma';
import { isPrismaHealthy } from '../database/prisma';
import { isRedisClientHealthy } from '../redis/redis';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: boolean;
    redis: boolean;
    memory: { rss: number; heapUsed: number; heapTotal: number };
  };
  uptime: number;
  timestamp: string;
}

export interface HealthCheckDeps {
  prisma: PrismaClient;
  redis: Redis;
}

export function createHealthCheck(deps: HealthCheckDeps): () => Promise<HealthStatus> {
  const { prisma, redis } = deps;

  return async function checkHealth(): Promise<HealthStatus> {
    const [database, redisOk] = await Promise.all([
      isPrismaHealthy(prisma),
      isRedisClientHealthy(redis),
    ]);

    const mem = process.memoryUsage();

    let status: HealthStatus['status'] = 'ok';
    if (!database && !redisOk) {
      status = 'error';
    } else if (!database || !redisOk) {
      status = 'degraded';
    }

    return {
      status,
      checks: {
        database,
        redis: redisOk,
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  };
}
