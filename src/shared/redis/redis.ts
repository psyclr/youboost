import Redis from 'ioredis';
import { createServiceLogger } from '../utils/logger';

const log = createServiceLogger('redis');

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number): number | null {
        if (times > 10) {
          log.error('Redis max reconnection attempts reached');
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        log.warn({ attempt: times, delay }, 'Redis reconnecting');
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      log.error({ err }, 'Redis connection error');
    });

    redis.on('connect', () => {
      log.info('Redis connected');
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  await client.ping();
  log.info('Redis connection verified');
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    log.info('Redis disconnected');
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedis();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    log.error({ err: error }, 'Redis health check failed');
    return false;
  }
}
