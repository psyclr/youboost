import { isDatabaseHealthy } from '../database/prisma';
import { isRedisHealthy } from '../redis/redis';

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

export async function checkHealth(): Promise<HealthStatus> {
  const [database, redis] = await Promise.all([isDatabaseHealthy(), isRedisHealthy()]);

  const mem = process.memoryUsage();

  let status: HealthStatus['status'] = 'ok';
  if (!database && !redis) {
    status = 'error';
  } else if (!database || !redis) {
    status = 'degraded';
  }

  return {
    status,
    checks: {
      database,
      redis,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
      },
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
